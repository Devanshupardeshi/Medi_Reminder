import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, TText } from '@/ui/Primitives';
import { colors, radius, spacing } from '@/theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

/**
 * Full-resolution in-app camera for prescription capture.
 *
 * Why this exists instead of `ImagePicker.launchCameraAsync`:
 *   The system-camera Intent route (used by ImagePicker) gives no control
 *   over capture resolution. Some Android OEM camera apps return
 *   downscaled or thumbnail-sized JPEGs when launched via Intent. Using
 *   `expo-camera`'s `CameraView` lets us call `takePictureAsync` directly
 *   with `quality: 1`, `skipProcessing: false` (rotates per EXIF so the
 *   backend OCR sees an upright image), and no resize — the resulting
 *   JPEG is full sensor resolution, identical to what the camera app's
 *   own gallery would show. This is the highest quality the device can
 *   produce short of writing native code.
 */
export function FullResCamera({ visible, onClose, onCapture }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);

  async function snap() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        // 1.0 = full sensor resolution, no recompression.
        quality: 1,
        // false = let the OS apply EXIF rotation so the saved JPEG is
        // upright. This is critical for OCR — rotated text fails Vision.
        skipProcessing: false,
        // Default JPEG; PNG would be larger with no quality benefit
        // for a phone camera output.
        exif: false,
      });
      if (photo?.uri) onCapture(photo.uri);
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {!permission ? (
          <View style={styles.permissionBox}>
            <ActivityIndicator color={colors.text.inverse} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <MaterialCommunityIcons
              name="camera-off"
              size={48}
              color={colors.text.inverse}
            />
            <TText
              variant="h3"
              color={colors.text.inverse}
              style={{ marginTop: spacing.md, textAlign: 'center' }}
            >
              Camera permission needed
            </TText>
            <TText
              variant="caption"
              color={colors.text.inverse}
              style={{
                marginTop: spacing.sm,
                opacity: 0.85,
                textAlign: 'center',
              }}
            >
              MediReminder needs the camera to scan your prescription at
              full resolution.
            </TText>
            <View style={{ height: spacing.xl }} />
            <Button
              title="Grant access"
              size="lg"
              fullWidth
              onPress={() => requestPermission()}
            />
            <Pressable
              onPress={onClose}
              style={{
                marginTop: spacing.md,
                alignSelf: 'center',
                paddingVertical: spacing.sm,
              }}
            >
              <TText variant="bodyBold" color={colors.text.inverse}>
                Cancel
              </TText>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              // No `pictureSize` prop on purpose — when omitted,
              // expo-camera picks the highest resolution the sensor
              // supports for the active aspect ratio. That's exactly
              // what we want for OCR.
              autofocus="on"
            />

            <View style={styles.topBar}>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityLabel="Close camera"
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.text.inverse}
                />
              </Pressable>
              <TText variant="bodyBold" color={colors.text.inverse}>
                Frame the prescription
              </TText>
              <View style={{ width: 36 }} />
            </View>

            <View style={styles.guide} pointerEvents="none">
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>

            <View style={styles.bottomBar}>
              <TText
                variant="caption"
                color={colors.text.inverse}
                style={{
                  textAlign: 'center',
                  opacity: 0.85,
                  marginBottom: spacing.md,
                }}
              >
                Hold steady. Lay paper flat in good light.
              </TText>
              <Pressable
                onPress={snap}
                disabled={capturing}
                style={[
                  styles.shutterOuter,
                  capturing && { opacity: 0.6 },
                ]}
                accessibilityLabel="Capture photo"
              >
                <View style={styles.shutterInner}>
                  {capturing ? (
                    <ActivityIndicator
                      color={colors.brand.navyDark}
                      size="small"
                    />
                  ) : null}
                </View>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const CORNER = 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionBox: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 120 : 80,
    backgroundColor: colors.brand.navyDark,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : spacing.xl,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  guide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: spacing.xl,
    marginTop: 120,
    marginBottom: 220,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 48 : spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
