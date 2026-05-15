/**
 * String dictionary for the bilingual UI.
 *
 * Keys are dot-namespaced by surface (sidebar.chat, profile.section.identity).
 * The English values double as the source of truth — change English first,
 * then add Arabic.
 *
 * "Smart Advisor" is the application brand and stays untranslated in both
 * maps. Course names live in the catalog (lib/advisor/fixtures/data/
 * courses.json -> course_name_ar) and are resolved by the courseDisplayName
 * helper at render time, not by this dict.
 */
import type { Lang } from "./types";

export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;
export type DayEnum = (typeof DAYS_EN)[number];

const DAYS_AR: Record<DayEnum, string> = {
  Sunday: "الأحد",
  Monday: "الإثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
};

export function localizedDay(day: string, lang: Lang): string {
  if (lang !== "ar") return day;
  return DAYS_AR[day as DayEnum] ?? day;
}

type Dict = Record<string, string>;

const en: Dict = {
  "brand.name": "Smart Advisor",
  "brand.tagline": "Your AI academic advisor",

  // Sidebar (main's nav)
  "sidebar.chatHome": "Chat Home",
  "sidebar.advisor": "Advisor",
  "sidebar.courses": "My Courses",
  "sidebar.mySchedule": "My Schedule",
  "sidebar.recommendations": "Recommendations",
  "sidebar.history": "History",
  "sidebar.newConversation": "New Conversation",
  "sidebar.signOut": "Sign Out",

  // TopNav (main's items)
  "topnav.home": "Home",
  "topnav.recommendations": "Recommendations",
  "topnav.insights": "Insights",
  "topnav.account": "Account",

  // Common buttons / states
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.loading": "Loading…",
  "common.search": "Search…",

  // Chat surface
  "chat.empty.title": "What would you like to explore?",
  "chat.empty.body": "Ask me about majors, careers, universities, or your next step.",
  "chat.placeholder": "Ask about majors, careers, universities…",
  "chat.send": "Send",
  "chat.advisor": "Advisor AI",
  "chat.error.fallback": "Something went wrong",
  "chat.quickReply.tellMore": "Tell me more",
  "chat.quickReply.majors": "What majors fit this?",
  "chat.quickReply.universities": "Which universities?",
  "chat.quickReply.skills": "Skills I should build",

  // Dashboard
  "dashboard.greeting": "Hi {name}, I'm your Smart Advisor.",
  "dashboard.subhead": "Tell me about your goals and interests. I'll help you choose the right major, explore careers, and find universities that fit you.",
  "dashboard.nudge.title": "Personalise your recommendations",
  "dashboard.nudge.body": "Add your interests and skills so I can give you sharper advice.",
  "dashboard.nudge.cta": "Complete profile",
  "dashboard.footer": "Powered by AI Advisor Engine · {year}",
  "dashboard.qs.major.eyebrow": "EXPLORE",
  "dashboard.qs.major.title": "Find my major",
  "dashboard.qs.major.desc": "Match my interests to degree programs",
  "dashboard.qs.major.prompt": "Based on my interests and skills, what majors should I consider? Explain why each is a good fit.",
  "dashboard.qs.career.eyebrow": "CAREER",
  "dashboard.qs.career.title": "Career paths",
  "dashboard.qs.career.desc": "Show me where my profile leads",
  "dashboard.qs.career.prompt": "Given my profile, what are the most promising career paths for me in the next 5–10 years?",
  "dashboard.qs.univ.eyebrow": "UNIVERSITIES",
  "dashboard.qs.univ.title": "Right-fit schools",
  "dashboard.qs.univ.desc": "Suggest universities for me",
  "dashboard.qs.univ.prompt": "Recommend universities that fit my interests and academic strengths.",
  "dashboard.qs.strategy.eyebrow": "STRATEGY",
  "dashboard.qs.strategy.title": "Study roadmap",
  "dashboard.qs.strategy.desc": "Plan the next semester",
  "dashboard.qs.strategy.prompt": "Build me a semester roadmap to develop the skills I need for my target career.",
  "dashboard.prompt.placeholder": "e.g. I want a career in AI but I'm also into design…",
  "dashboard.prompt.try": "Try:",
  "dashboard.prompt.suggestion1": "I like coding and maths",
  "dashboard.prompt.suggestion2": "Best careers for someone who loves biology",
  "dashboard.prompt.suggestion3": "Compare CS vs Data Science",
  "common.send": "Send",

  // Schedule page
  "schedule.eyebrow": "MY SCHEDULE",
  "schedule.heading": "My Schedule",
  "schedule.subheading": "Your weekly class plan for this semester.",
  "schedule.empty.title": "No schedule yet",
  "schedule.empty.body": "Ask the advisor to build one for you.",

  // Courses page
  "courses.eyebrow": "MY COURSES",
  "courses.heading": "Course Catalog",
  "courses.subheading": "Browse the full catalog of courses offered this semester.",

  // Recommendations page
  "recommendations.eyebrow": "RECOMMENDATIONS",
  "recommendations.heading": "Saved Recommendations",
  "recommendations.subheading": "Suggestions you've saved from your chats — majors, careers, and universities.",
  "recommendations.empty.title": "Nothing saved yet",
  "recommendations.empty.body": "When the advisor suggests something good, save it from the chat to see it here.",

  // History page
  "history.eyebrow": "CONVERSATION HISTORY",
  "history.heading": "Your past conversations",
  "history.subheading": "Pick up where you left off, or revisit advice you've already received.",
  "history.empty.title": "No conversations yet",
  "history.empty.body": "Start a new chat with the advisor from the sidebar.",

  // Profile page
  "profile.eyebrow": "YOUR PROFILE",
  "profile.heading": "Tell me who you are",
  "profile.subheading": "The more I know about your interests and goals, the sharper my recommendations become. You can update any field at any time.",
  "profile.save": "Save profile",
  "profile.saving": "Saving…",
  "profile.saved": "Profile saved.",
  "profile.notSignedIn": "Not signed in.",
  "profile.section.language": "Interface language",
  "profile.section.identity": "Identity",
  "profile.section.story": "A bit about you",
  "profile.section.interests": "Interests",
  "profile.section.skills": "Skills",
  "profile.section.grades": "Academic record (optional)",
  "profile.field.fullName": "Full name",
  "profile.field.fullNamePlaceholder": "Alex Miller",
  "profile.field.email": "Email",
  "profile.field.bio": "Short bio",
  "profile.field.bioPlaceholder": "e.g. Curious about AI, love hiking, looking for a balance between tech and design…",
  "profile.field.gpa": "Current GPA (out of 4.0)",
  "profile.field.gpaPlaceholder": "e.g. 3.7",
  "profile.field.interestsLabel": "What excites you academically?",
  "profile.field.interestsPlaceholder": "Add an interest and press Enter",
  "profile.field.skillsLabel": "Skills you already have",
  "profile.field.skillsPlaceholder": "Add a skill and press Enter",
  "profile.lang.sub": "Sets the interface direction and the language the advisor replies in.",
  "profile.lang.englishHint": "LTR · default",
  "profile.lang.arabicHint": "RTL · يرد المساعد بالعربية",

  // Auth — Login
  "auth.welcomeBack": "Welcome back",
  "auth.signInToContinue": "Sign in to continue your academic journey.",
  "auth.email": "Email",
  "auth.emailPlaceholderLogin": "you@gmail.com",
  "auth.password": "Password",
  "auth.passwordPlaceholder": "••••••••",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing in…",
  "auth.invalidCredentials": "Invalid email or password.",
  "auth.noAccount": "New here?",
  "auth.createAccount": "Create an account",

  // Auth — Signup
  "auth.beginJourney": "Begin your journey",
  "auth.tagline": "Let's map your academic path, together.",
  "auth.fullName": "Full name",
  "auth.fullNamePlaceholder": "Alex Miller",
  "auth.emailPlaceholderSignup": "you@university.edu",
  "auth.passwordPlaceholderSignup": "At least 6 characters",
  "auth.creatingAccount": "Creating account…",
  "auth.createAccountButton": "Create account",
  "auth.haveAccount": "Already have an account?",
  "auth.confirmEmail": "Account created! Check your inbox for a confirmation link before signing in.",
  "auth.signupError": "Could not create account. The email may already be in use, or your password may be too weak.",
};

const ar: Dict = {
  "brand.name": "Smart Advisor",
  "brand.tagline": "مستشارك الأكاديمي بالذكاء الاصطناعي",

  "sidebar.chatHome": "الدردشة",
  "sidebar.advisor": "المستشار",
  "sidebar.courses": "موادي",
  "sidebar.mySchedule": "جدولي",
  "sidebar.recommendations": "التوصيات",
  "sidebar.history": "السجل",
  "sidebar.newConversation": "محادثة جديدة",
  "sidebar.signOut": "تسجيل الخروج",

  "topnav.home": "الرئيسية",
  "topnav.recommendations": "التوصيات",
  "topnav.insights": "إحصاءات",
  "topnav.account": "الحساب",

  "common.cancel": "إلغاء",
  "common.save": "حفظ",
  "common.loading": "جارٍ التحميل…",
  "common.search": "بحث…",

  "chat.empty.title": "ماذا تود أن تستكشف؟",
  "chat.empty.body": "اسألني عن التخصصات أو المسارات المهنية أو الجامعات أو خطوتك القادمة.",
  "chat.placeholder": "اسأل عن التخصصات أو المسارات المهنية أو الجامعات…",
  "chat.send": "إرسال",
  "chat.advisor": "المستشار الذكي",
  "chat.error.fallback": "حدث خطأ ما",
  "chat.quickReply.tellMore": "أخبرني المزيد",
  "chat.quickReply.majors": "ما التخصصات المناسبة؟",
  "chat.quickReply.universities": "أي جامعات؟",
  "chat.quickReply.skills": "ما المهارات التي يجب أن أبنيها؟",

  "dashboard.greeting": "مرحبًا {name}، أنا Smart Advisor الخاص بك.",
  "dashboard.subhead": "أخبرني عن أهدافك واهتماماتك. سأساعدك على اختيار التخصص المناسب واستكشاف المسارات المهنية وإيجاد الجامعات التي تناسبك.",
  "dashboard.nudge.title": "خصّص توصياتك",
  "dashboard.nudge.body": "أضف اهتماماتك ومهاراتك حتى أتمكن من تقديم نصائح أدقّ.",
  "dashboard.nudge.cta": "أكمل ملفك الشخصي",
  "dashboard.footer": "مدعوم بمحرّك AI Advisor · {year}",
  "dashboard.qs.major.eyebrow": "استكشاف",
  "dashboard.qs.major.title": "اعثر على تخصصي",
  "dashboard.qs.major.desc": "اربط اهتماماتي ببرامج الدراسة المناسبة",
  "dashboard.qs.major.prompt": "بناءً على اهتماماتي ومهاراتي، ما التخصصات التي يجب أن أفكّر فيها؟ اشرح لماذا يناسبني كل واحد منها.",
  "dashboard.qs.career.eyebrow": "المسار المهني",
  "dashboard.qs.career.title": "المسارات المهنية",
  "dashboard.qs.career.desc": "أرني إلى أين يقودني ملفي الشخصي",
  "dashboard.qs.career.prompt": "بناءً على ملفي الشخصي، ما هي أكثر المسارات المهنية الواعدة لي خلال الـ 5 إلى 10 سنوات القادمة؟",
  "dashboard.qs.univ.eyebrow": "الجامعات",
  "dashboard.qs.univ.title": "الجامعات المناسبة",
  "dashboard.qs.univ.desc": "اقترح علي جامعات",
  "dashboard.qs.univ.prompt": "اقترح علي جامعات تناسب اهتماماتي ونقاط قوّتي الأكاديمية.",
  "dashboard.qs.strategy.eyebrow": "استراتيجية",
  "dashboard.qs.strategy.title": "خارطة الدراسة",
  "dashboard.qs.strategy.desc": "خطّط للفصل القادم",
  "dashboard.qs.strategy.prompt": "ابنِ لي خارطة فصلية لتطوير المهارات التي أحتاجها لمساري المهني المستهدف.",
  "dashboard.prompt.placeholder": "مثال: أريد مسارًا في الذكاء الاصطناعي لكنني أحب التصميم أيضًا…",
  "dashboard.prompt.try": "جرّب:",
  "dashboard.prompt.suggestion1": "أحب البرمجة والرياضيات",
  "dashboard.prompt.suggestion2": "أفضل المسارات لمن يحب علم الأحياء",
  "dashboard.prompt.suggestion3": "قارن بين علوم الحاسوب وعلم البيانات",
  "common.send": "إرسال",

  "schedule.eyebrow": "جدولي",
  "schedule.heading": "جدولي",
  "schedule.subheading": "خطة محاضراتك الأسبوعية لهذا الفصل.",
  "schedule.empty.title": "لا يوجد جدول بعد",
  "schedule.empty.body": "اطلب من المستشار أن يبني لك جدولًا.",

  "courses.eyebrow": "موادي",
  "courses.heading": "كتالوج المواد",
  "courses.subheading": "تصفّح جميع المواد المطروحة هذا الفصل.",

  "recommendations.eyebrow": "التوصيات",
  "recommendations.heading": "التوصيات المحفوظة",
  "recommendations.subheading": "الاقتراحات التي حفظتها من محادثاتك — التخصصات والمسارات المهنية والجامعات.",
  "recommendations.empty.title": "لا يوجد شيء محفوظ بعد",
  "recommendations.empty.body": "عندما يقترح المستشار شيئًا جيدًا، احفظه من المحادثة لتجده هنا.",

  "history.eyebrow": "سجل المحادثات",
  "history.heading": "محادثاتك السابقة",
  "history.subheading": "تابع من حيث توقفت أو راجع نصائح سبق أن حصلت عليها.",
  "history.empty.title": "لا توجد محادثات بعد",
  "history.empty.body": "ابدأ محادثة جديدة مع المستشار من الشريط الجانبي.",

  "profile.eyebrow": "ملفك الشخصي",
  "profile.heading": "أخبرني عن نفسك",
  "profile.subheading": "كلما عرفت أكثر عن اهتماماتك وأهدافك، تحسّنت توصياتي. يمكنك تحديث أي حقل في أي وقت.",
  "profile.save": "حفظ الملف الشخصي",
  "profile.saving": "جارٍ الحفظ…",
  "profile.saved": "تم حفظ الملف.",
  "profile.notSignedIn": "غير مسجَّل الدخول.",
  "profile.section.language": "لغة الواجهة",
  "profile.section.identity": "الهوية",
  "profile.section.story": "نبذة عنك",
  "profile.section.interests": "الاهتمامات",
  "profile.section.skills": "المهارات",
  "profile.section.grades": "السجل الأكاديمي (اختياري)",
  "profile.field.fullName": "الاسم الكامل",
  "profile.field.fullNamePlaceholder": "عبدالرحمن القرعان",
  "profile.field.email": "البريد الإلكتروني",
  "profile.field.bio": "نبذة مختصرة",
  "profile.field.bioPlaceholder": "مثال: مهتم بالذكاء الاصطناعي، أحب المشي، وأبحث عن توازن بين التقنية والتصميم…",
  "profile.field.gpa": "المعدل التراكمي (من 4.0)",
  "profile.field.gpaPlaceholder": "مثال: 3.7",
  "profile.field.interestsLabel": "ما الذي يثير اهتمامك أكاديميًا؟",
  "profile.field.interestsPlaceholder": "أضف اهتمامًا ثم اضغط Enter",
  "profile.field.skillsLabel": "المهارات التي لديك بالفعل",
  "profile.field.skillsPlaceholder": "أضف مهارة ثم اضغط Enter",
  "profile.lang.sub": "يبدّل اتجاه الواجهة واللغة التي يرد بها المستشار.",
  "profile.lang.englishHint": "LTR · افتراضي",
  "profile.lang.arabicHint": "RTL · يرد المساعد بالعربية",

  "auth.welcomeBack": "أهلًا بعودتك",
  "auth.signInToContinue": "سجّل الدخول لمتابعة رحلتك الأكاديمية.",
  "auth.email": "البريد الإلكتروني",
  "auth.emailPlaceholderLogin": "you@gmail.com",
  "auth.password": "كلمة المرور",
  "auth.passwordPlaceholder": "••••••••",
  "auth.showPassword": "إظهار كلمة المرور",
  "auth.hidePassword": "إخفاء كلمة المرور",
  "auth.signIn": "تسجيل الدخول",
  "auth.signingIn": "جارٍ تسجيل الدخول…",
  "auth.invalidCredentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth.noAccount": "مستخدم جديد؟",
  "auth.createAccount": "إنشاء حساب",

  "auth.beginJourney": "ابدأ رحلتك",
  "auth.tagline": "لنرسم مسارك الأكاديمي معًا.",
  "auth.fullName": "الاسم الكامل",
  "auth.fullNamePlaceholder": "عبدالرحمن القرعان",
  "auth.emailPlaceholderSignup": "you@university.edu",
  "auth.passwordPlaceholderSignup": "6 أحرف على الأقل",
  "auth.creatingAccount": "جارٍ إنشاء الحساب…",
  "auth.createAccountButton": "إنشاء الحساب",
  "auth.haveAccount": "لديك حساب بالفعل؟",
  "auth.confirmEmail": "تم إنشاء الحساب! تحقّق من بريدك الإلكتروني لرابط التأكيد قبل تسجيل الدخول.",
  "auth.signupError": "تعذّر إنشاء الحساب. ربما البريد مستخدم بالفعل، أو كلمة المرور ضعيفة جدًا.",
};

export const dict = { en, ar } satisfies Record<Lang, Dict>;

/** Translate a key. Falls back to the English value, then to the key itself. */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  const raw = dict[lang]?.[key] ?? dict.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name) => {
    const v = params[name];
    return v === undefined ? "" : String(v);
  });
}
