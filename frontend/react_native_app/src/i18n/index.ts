import { useVoiceLanguageStore } from '@/state/voiceLanguageStore';
import type { VoiceLang } from '@/services/voiceService';

/**
 * Lightweight i18n layer.
 *
 * The same `voiceLanguageStore` that drives TTS reminders is also used
 * to translate visible UI strings — so when the user picks Hindi or
 * Marathi from the header language icon, the entire app re-renders in
 * that language thanks to Zustand's reactive subscriptions.
 *
 * We keep the dictionary small and focused on the most user-visible
 * surfaces (tabs, screen titles, primary buttons, common errors).
 * Anything not in the dictionary falls back to the English string the
 * caller passed in via `t('home.title', 'Home')`.
 */
type Dict = Record<string, string>;

const en: Dict = {
  // Tabs
  'tab.home': 'Home',
  'tab.medicines': 'Medicines',
  'tab.family': 'Family',
  'tab.reports': 'Reports',
  'tab.more': 'More',

  // App headers
  'header.greeting.morning': 'Good morning',
  'header.greeting.afternoon': 'Good afternoon',
  'header.greeting.evening': 'Good evening',
  'header.medicines': 'Your medicines',
  'header.family': 'Family & caregivers',
  'header.reports': 'Reports',
  'header.settings': 'Settings',
  'header.review': 'Review prescription',
  'header.history': 'History',

  // Scan screen
  'scan.title': 'Add New Prescription',
  'scan.takePhoto': 'Take Photo',
  'scan.uploadGallery': 'Upload from Gallery',
  'scan.analyse': 'Analyse with AI',
  'scan.analysing': 'Analysing\u2026',
  'scan.tryAgain': 'Try again',
  'scan.retake': 'Retake photo',
  'scan.tip': 'Tip: Keep paper flat and in good light',
  'scan.analysingTitle': 'Analysing prescription\u2026',
  'scan.analysingHelp':
    'Reading text, generating reminders, and checking food interactions. This can take 30\u201360 seconds.',
  'scan.errorNoMeds':
    'No medicines were detected. Take a fresh photo: lay the paper flat in good light and fill the frame.',

  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.delete': 'Delete',
  'common.signOut': 'Sign out',
  'common.loading': 'Loading\u2026',
  'common.sessionExpiredTitle': 'Session expired',
  'common.sessionExpiredBody': 'Please sign in again to continue.',

  // Home
  'home.todaysDoses': "Today's doses",
  'home.noDoses': 'No doses scheduled today.',
  'home.markTaken': 'Mark taken',
  'home.snooze': 'Snooze',

  // Language picker
  'lang.title': 'Choose voice & app language',
  'lang.subtitle':
    'This changes the voice for reminders and the language of major screen text.',
  'lang.preview': 'Preview voice',
};

const hi: Dict = {
  'tab.home': 'होम',
  'tab.medicines': 'दवाइयाँ',
  'tab.family': 'परिवार',
  'tab.reports': 'रिपोर्ट',
  'tab.more': 'और',

  'header.greeting.morning': 'सुप्रभात',
  'header.greeting.afternoon': 'नमस्कार',
  'header.greeting.evening': 'शुभ संध्या',
  'header.medicines': 'आपकी दवाइयाँ',
  'header.family': 'परिवार और देखभालकर्ता',
  'header.reports': 'रिपोर्ट',
  'header.settings': 'सेटिंग्स',
  'header.review': 'पर्चे की समीक्षा',
  'header.history': 'इतिहास',

  'scan.title': 'नया पर्चा जोड़ें',
  'scan.takePhoto': 'फोटो लें',
  'scan.uploadGallery': 'गैलरी से अपलोड करें',
  'scan.analyse': 'AI से विश्लेषण करें',
  'scan.analysing': 'विश्लेषण हो रहा है\u2026',
  'scan.tryAgain': 'फिर कोशिश करें',
  'scan.retake': 'फिर से फोटो लें',
  'scan.tip': 'सुझाव: कागज़ सीधा और अच्छी रोशनी में रखें',
  'scan.analysingTitle': 'पर्चे का विश्लेषण हो रहा है\u2026',
  'scan.analysingHelp':
    'टेक्स्ट पढ़ा जा रहा है, रिमाइंडर बन रहे हैं और खान-पान सलाह जाँची जा रही है। इसमें 30\u201360 सेकंड लग सकते हैं।',
  'scan.errorNoMeds':
    'कोई दवा नहीं मिली। नया फोटो लें: कागज़ सीधा रखें, अच्छी रोशनी हो और फ्रेम भर जाए।',

  'common.save': 'सहेजें',
  'common.cancel': 'रद्द करें',
  'common.confirm': 'पुष्टि करें',
  'common.delete': 'हटाएं',
  'common.signOut': 'साइन आउट',
  'common.loading': 'लोड हो रहा है\u2026',
  'common.sessionExpiredTitle': 'सत्र समाप्त',
  'common.sessionExpiredBody': 'जारी रखने के लिए दोबारा साइन इन करें।',

  'home.todaysDoses': 'आज की खुराक',
  'home.noDoses': 'आज कोई खुराक निर्धारित नहीं है।',
  'home.markTaken': 'ली गई बताएं',
  'home.snooze': 'स्नूज़',

  'lang.title': 'आवाज़ और ऐप भाषा चुनें',
  'lang.subtitle':
    'यह रिमाइंडर की आवाज़ और मुख्य स्क्रीन की भाषा बदल देता है।',
  'lang.preview': 'आवाज़ सुनें',
};

const mr: Dict = {
  'tab.home': 'मुख्यपृष्ठ',
  'tab.medicines': 'औषधे',
  'tab.family': 'कुटुंब',
  'tab.reports': 'अहवाल',
  'tab.more': 'अधिक',

  'header.greeting.morning': 'सुप्रभात',
  'header.greeting.afternoon': 'नमस्कार',
  'header.greeting.evening': 'शुभ संध्या',
  'header.medicines': 'तुमची औषधे',
  'header.family': 'कुटुंब आणि काळजी घेणारे',
  'header.reports': 'अहवाल',
  'header.settings': 'सेटिंग्ज',
  'header.review': 'चिठ्ठीचा आढावा',
  'header.history': 'इतिहास',

  'scan.title': 'नवी चिठ्ठी जोडा',
  'scan.takePhoto': 'फोटो काढा',
  'scan.uploadGallery': 'गॅलरीतून अपलोड करा',
  'scan.analyse': 'AI ने तपासा',
  'scan.analysing': 'तपासणी सुरू आहे\u2026',
  'scan.tryAgain': 'पुन्हा प्रयत्न करा',
  'scan.retake': 'पुन्हा फोटो काढा',
  'scan.tip': 'टीप: कागद सरळ ठेवा आणि चांगला उजेड असू द्या',
  'scan.analysingTitle': 'चिठ्ठी तपासली जात आहे\u2026',
  'scan.analysingHelp':
    'मजकूर वाचला जात आहे, स्मरणपत्रे तयार होत आहेत आणि अन्न-संवाद तपासला जात आहे. यासाठी 30\u201360 सेकंद लागू शकतात.',
  'scan.errorNoMeds':
    'कोणतीही औषधे आढळली नाहीत. नवीन फोटो काढा: कागद सरळ ठेवा, चांगला उजेड द्या आणि फ्रेम भरा.',

  'common.save': 'जतन करा',
  'common.cancel': 'रद्द करा',
  'common.confirm': 'पुष्टी करा',
  'common.delete': 'हटवा',
  'common.signOut': 'साइन आउट',
  'common.loading': 'लोड होत आहे\u2026',
  'common.sessionExpiredTitle': 'सत्र संपले',
  'common.sessionExpiredBody':
    'पुढे जाण्यासाठी कृपया पुन्हा साइन इन करा.',

  'home.todaysDoses': 'आजच्या डोस',
  'home.noDoses': 'आज कोणताही डोस नियोजित नाही.',
  'home.markTaken': 'घेतली अशी नोंद करा',
  'home.snooze': 'थांबवा',

  'lang.title': 'आवाज आणि अ‍ॅप भाषा निवडा',
  'lang.subtitle':
    'यामुळे स्मरणपत्रांचा आवाज आणि मुख्य स्क्रीन भाषा बदलते.',
  'lang.preview': 'आवाज ऐका',
};

const DICTS: Record<VoiceLang, Dict> = { en, hi, mr };

/**
 * React hook — re-renders the calling component when the user changes
 * language via the header picker. `t(key)` returns the translation for
 * the current language; `t(key, fallback)` returns the fallback if the
 * key is missing in any dictionary (which makes incremental translation
 * safe — untranslated strings stay readable).
 */
export function useT(): (key: string, fallback?: string) => string {
  const lang = useVoiceLanguageStore((s) => s.lang);
  const dict = DICTS[lang] ?? en;
  return (key: string, fallback?: string) =>
    dict[key] ?? en[key] ?? fallback ?? key;
}

/** Non-hook variant for service code (notification bodies, etc.). */
export function tFor(lang: VoiceLang, key: string, fallback?: string): string {
  const dict = DICTS[lang] ?? en;
  return dict[key] ?? en[key] ?? fallback ?? key;
}
