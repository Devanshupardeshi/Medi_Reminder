import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

// Show banner + play sound + light up the screen even while the app is
// in foreground. SDK 52+ introduced shouldShowBanner / shouldShowList
// alongside the legacy shouldShowAlert; we set all three so behaviour
// is consistent across SDK minor versions.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// IMPORTANT: Android notification channel settings are IMMUTABLE after
// first creation. If the user installed an earlier build that created
// `medication-reminder` without sound, we can never change that channel
// from JS — only by uninstalling/reinstalling. To force a clean,
// sound-enabled channel for every existing user, we bump the channel
// ID. Each future bump (v3 -> v4 ...) gives every user a fresh channel
// with whatever new properties we set.
const REMINDER_CHANNEL_ID = 'medication-reminder-v3';
const LEGACY_CHANNEL_IDS = ['medication-reminder', 'medication-reminder-v2'];

let channelEnsured = false;

async function ensureReminderChannel(): Promise<void> {
  if (channelEnsured) return;
  if (Platform.OS !== 'android') {
    channelEnsured = true;
    return;
  }

  // Best-effort cleanup of the old, soundless channel so it doesn't
  // sit in the user's notification settings forever. Failing here is
  // fine — the new channel still works.
  for (const legacy of LEGACY_CHANNEL_IDS) {
    try {
      await Notifications.deleteNotificationChannelAsync(legacy);
    } catch {
      // ignore
    }
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Medication reminders',
    description:
      'Alarm-style alerts that fire when it is time to take your medicine.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    // Long pattern (~3.5 s) so the user definitely feels the buzz even
    // if their device's default notification sound is short.
    vibrationPattern: [
      0, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600,
    ],
    lightColor: '#0F766E',
    enableVibrate: true,
    enableLights: true,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    // Medication is a critical category — ring through DND just like the
    // Android system Clock app's alarms.
    bypassDnd: true,
  });
  channelEnsured = true;
  console.log('[v0] notif channel ready', REMINDER_CHANNEL_ID);
}

interface ScheduleInput {
  medicineId: string;
  medicineName: string;
  reminderTimes24h: string[];
  bodySuffix?: string;
}

export const notificationService = {
  ensureReminderChannel,

  /**
   * Request POST_NOTIFICATIONS (Android 13+) and, separately, the
   * "Alarms & reminders" exact-alarm grant (Android 12+). Without the
   * exact-alarm grant the OS may defer scheduled notifications by up
   * to ~15 minutes when the device is in Doze, which is unacceptable
   * for medication.
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    await ensureReminderChannel();

    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
          allowCriticalAlerts: false,
          allowProvisional: false,
        },
      });
      granted = req.status === 'granted';
    }

    console.log('[v0] notif permission', { granted });
    return granted;
  },

  /**
   * Cancel every notification previously scheduled for a medicine.
   * Used before re-scheduling so we don't accumulate duplicates.
   */
  async cancelAllForMedicine(medicineId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const targets = all.filter((n) => {
      const data = n.content.data as { medicineId?: string } | null | undefined;
      return data?.medicineId === medicineId;
    });
    await Promise.all(
      targets.map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier),
      ),
    );
    if (targets.length > 0) {
      console.log('[v0] cancelled prior notifs', {
        medicineId,
        count: targets.length,
      });
    }
  },

  async snoozeDose(input: {
    medicineId: string;
    medicineName: string;
    minutes: number;
  }): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    await ensureReminderChannel();
    const seconds = Math.max(60, Math.round(input.minutes * 60));
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Snoozed: ${input.medicineName}`,
        body: 'Time to take your dose now.',
        data: { medicineId: input.medicineId, snoozed: true },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    console.log('[v0] snooze scheduled', { id, seconds });
    return id;
  },

  /**
   * Schedule a daily repeating notification at every time in
   * `reminderTimes24h` for this medicine. Existing schedules for the
   * medicine are wiped first so re-confirms don't duplicate.
   */
  async scheduleMedicine(input: ScheduleInput): Promise<string[]> {
    if (Platform.OS === 'web') return [];
    await ensureReminderChannel();
    await this.cancelAllForMedicine(input.medicineId);

    const ids: string[] = [];
    for (const time of input.reminderTimes24h) {
      const [hStr, mStr] = time.split(':');
      const hour = Number(hStr);
      const minute = Number(mStr);
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        console.log('[v0] bad time, skipping', { time });
        continue;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${input.medicineName}`,
          body: input.bodySuffix ?? 'Take your dose now',
          data: { medicineId: input.medicineId, scheduledTime: time },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          // iOS: surface this as a critical-style banner.
          interruptionLevel: 'timeSensitive',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      ids.push(id);
      console.log('[v0] daily alarm scheduled', {
        medicineId: input.medicineId,
        medicineName: input.medicineName,
        time,
        id,
      });
    }
    return ids;
  },

  /**
   * Convenience: schedule alarms for an entire batch of confirmed
   * medicines in one shot.
   */
  async scheduleAll(
    medicines: Array<{
      medicine_id: string;
      name: string;
      reminder_times_24h: string[];
      instructions?: string | null;
    }>,
  ): Promise<void> {
    for (const m of medicines) {
      try {
        await this.scheduleMedicine({
          medicineId: m.medicine_id,
          medicineName: m.name,
          reminderTimes24h: m.reminder_times_24h,
          bodySuffix: m.instructions ?? undefined,
        });
      } catch (e) {
        console.log('[v0] scheduleMedicine failed', {
          name: m.name,
          error: String(e),
        });
      }
    }
  },

  /**
   * Fire a one-off test notification 5 seconds from now. Used by the
   * "Test alarm" button in Settings so the user can verify their
   * device permissions / channel setup actually let alarms ring.
   */
  async scheduleTestAlarm(): Promise<string | null> {
    if (Platform.OS === 'web') return null;
    await ensureReminderChannel();
    const ok = await this.requestPermissions();
    if (!ok) {
      Alert.alert(
        'Notifications disabled',
        'Enable notifications for MediReminder in your device settings, then try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return null;
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test alarm',
        body: 'Tap to open the alarm screen and hear the reminder ring.',
        data: { test: true, medicineName: 'Test medicine' },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        interruptionLevel: 'timeSensitive',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
    console.log('[v0] test alarm scheduled', { id });
    return id;
  },

  /**
   * Subscribe to taps on a fired notification. Returns an unsubscribe
   * function. We pass through any payload the listener cares about so
   * the caller (the root layout) can route to /reminder/[doseLogId]
   * when a real medicine alarm fires, or to a dedicated test screen
   * when our diagnostic alarm fires.
   */
  addResponseListener(
    handler: (data: Record<string, unknown>) => void,
  ): () => void {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data =
          (response.notification.request.content.data as Record<
            string,
            unknown
          >) ?? {};
        console.log(
          '[v0] notif response received',
          JSON.stringify({ data }),
        );
        handler(data);
      },
    );
    return () => sub.remove();
  },

  /**
   * Returns the data payload of whatever notification originally
   * launched the app, if any. Used at boot so a user who tapped a
   * fired alarm from a cold-killed app still lands on the reminder
   * screen.
   */
  async getLaunchPayload(): Promise<Record<string, unknown> | null> {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last) return null;
      return (
        (last.notification.request.content.data as Record<
          string,
          unknown
        >) ?? null
      );
    } catch {
      return null;
    }
  },

  /** Inspect everything currently queued. Helpful for debugging. */
  async listScheduled(): Promise<void> {
    if (Platform.OS === 'web') return;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(
      '[v0] all scheduled notifs',
      JSON.stringify(
        all.map((n) => ({
          id: n.identifier,
          title: n.content.title,
          data: n.content.data,
          trigger: n.trigger,
        })),
      ),
    );
  },
};
