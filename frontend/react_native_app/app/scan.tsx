import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, TText, Screen } from '@/ui/Primitives';
import { FullResCamera } from '@/ui/FullResCamera';
import { colors, radius, spacing } from '@/theme/colors';
import {
  describeUploadError,
  uploadPrescription,
} from '@/services/prescriptionApi';
import { usePrescriptionDraftStore } from '@/state/prescriptionDraftStore';

type Stage = 'idle' | 'preview' | 'uploading';

export default function ScanScreen() {
  const router = useRouter();
  const setDraft = usePrescriptionDraftStore((s) => s.setDraft);
  const [stage, setStage] = useState<Stage>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState<boolean>(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function ensureLibraryPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photos permission needed',
        'Please allow photo access to upload from your gallery.',
      );
      return false;
    }
    return true;
  }

  function takePhoto() {
    setError(null);
    setCameraOpen(true);
  }

  function onCaptured(uri: string) {
    setCameraOpen(false);
    setImageUri(uri);
    setStage('preview');
  }

  async function pickFromGallery() {
    setError(null);
    if (!(await ensureLibraryPermission())) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      exif: false,
    });
    if (!res.canceled && res.assets[0]) {
      setImageUri(res.assets[0].uri);
      setStage('preview');
    }
  }

  async function analyse() {
    if (!imageUri) return;
    setStage('uploading');
    setError(null);
    setRetryable(false);
    try {
      const draft = await uploadPrescription({
        uri: imageUri,
        language: 'en',
      });
      if (draft.status !== 'awaiting_confirmation') {
        setImageUri(null);
        setStage('idle');
        setRetryable(false);
        setError(
          'No medicines were detected. Take a fresh photo: lay the paper flat in good light and fill the frame.',
        );
        return;
      }
      setDraft(draft);
      router.replace('/review');
    } catch (e) {
      const { message, retryable: canRetry } = describeUploadError(e);
      if (!canRetry) {
        setImageUri(null);
        setStage('idle');
      } else {
        setStage('preview');
      }
      setError(message);
      setRetryable(canRetry);
    }
  }

  function reshoot() {
    setImageUri(null);
    setError(null);
    setRetryable(false);
    setStage('idle');
  }

  const uploading = stage === 'uploading';

  return (
    <Screen style={{ backgroundColor: colors.brand.navyDark }}>
      <Stack.Screen options={{ headerShown: false }} />

      <FullResCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onCaptured}
      />

      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Close"
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="close" size={24} color={colors.text.inverse} />
        </Pressable>
        <TText variant="h3" color={colors.text.inverse}>
          Add New Prescription
        </TText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.canvas}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.preview}
            resizeMode="cover"
          />
        ) : (
          <CaptureGuide />
        )}

        {uploading ? (
          <View style={styles.uploadingOverlay} pointerEvents="auto">
            <MaterialCommunityIcons
              name="brain"
              size={48}
              color={colors.text.inverse}
            />
            <TText
              variant="h3"
              color={colors.text.inverse}
              style={{ marginTop: spacing.md }}
            >
              Analysing prescription…
            </TText>
            <TText
              variant="caption"
              color={colors.text.inverse}
              style={{ opacity: 0.8, marginTop: 4, textAlign: 'center' }}
            >
              Reading text, generating reminders, and checking food
              interactions. This can take 30–60 seconds.
            </TText>
          </View>
        ) : null}
      </View>

      <TText
        variant="caption"
        color={colors.text.inverse}
        style={styles.tip}
      >
        Tip: Keep paper flat and in good light
      </TText>

      {error ? (
        <View style={styles.errorPill}>
          <Ionicons
            name="alert-circle"
            size={18}
            color={colors.accent.danger}
          />
          <TText
            variant="caption"
            color={colors.text.inverse}
            style={{ flex: 1 }}
          >
            {error}
          </TText>
        </View>
      ) : null}

      <View style={styles.actionBar}>
        {stage === 'idle' ? (
          <>
            <Button
              title="Take Photo"
              variant="secondary"
              size="lg"
              fullWidth
              onPress={takePhoto}
              icon={
                <Ionicons
                  name="camera"
                  size={20}
                  color={colors.text.inverse}
                />
              }
            />
            <Button
              title="Upload from Gallery"
              variant="ghost"
              size="lg"
              fullWidth
              onPress={pickFromGallery}
              style={{
                marginTop: spacing.md,
                backgroundColor: 'transparent',
                borderColor: colors.text.inverse,
                borderWidth: 1,
              }}
              icon={
                <Ionicons
                  name="image"
                  size={20}
                  color={colors.text.inverse}
                />
              }
            />
          </>
        ) : (
          <>
            <Button
              title={
                uploading
                  ? 'Analysing…'
                  : retryable && error
                    ? 'Try again'
                    : 'Analyse with AI'
              }
              size="lg"
              fullWidth
              loading={uploading}
              onPress={analyse}
            />
            <Pressable
              onPress={reshoot}
              disabled={uploading}
              style={{
                marginTop: spacing.md,
                alignSelf: 'center',
                paddingVertical: spacing.sm,
              }}
            >
              <TText
                variant="bodyBold"
                color={colors.text.inverse}
                style={{ opacity: uploading ? 0.5 : 0.9 }}
              >
                Retake photo
              </TText>
            </Pressable>
          </>
        )}
      </View>
    </Screen>
  );
}

function CaptureGuide() {
  return (
    <View style={styles.guide}>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
      <View style={styles.guideCenter}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={64}
          color="rgba(255,255,255,0.4)"
        />
        <TText
          variant="caption"
          color="rgba(255,255,255,0.7)"
          style={{ marginTop: spacing.sm }}
        >
          Capture guide
        </TText>
      </View>
    </View>
  );
}

const CORNER = 28;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.xl,
    paddingBottom: spacing.lg,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  canvas: {
    marginHorizontal: spacing.lg,
    aspectRatio: 0.78,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  preview: { width: '100%', height: '100%' },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  guide: { flex: 1 },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: spacing.lg,
    left: spacing.lg,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: spacing.lg,
    right: spacing.lg,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: spacing.lg,
    left: spacing.lg,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: spacing.lg,
    right: spacing.lg,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  guideCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tip: {
    textAlign: 'center',
    marginTop: spacing.md,
    opacity: 0.75,
  },
  errorPill: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(220,38,38,0.18)',
    borderWidth: 1,
    borderColor: colors.accent.danger,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBar: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
