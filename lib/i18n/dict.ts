/**
 * String dictionary for the bilingual UI.
 *
 * Keys are dot-namespaced by surface (sidebar.chat, schedule.discard, etc.).
 * The English values double as the source of truth — comments / PRs should
 * change English first, then add Arabic. "Smart Advisor" is the brand and
 * stays untranslated in both maps. Course names live in the catalog
 * (lib/advisor/fixtures/data/courses.json -> course_name_ar) and use the
 * `courseDisplayName` helper at render time, not this dict.
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

  // Sidebar
  "sidebar.chat": "Chat",
  "sidebar.mySchedule": "My Schedule",
  "sidebar.semester": "Semester Schedule",
  "sidebar.profile": "Profile",
  "sidebar.tips": "Study Tips",
  "sidebar.history": "History",
  "sidebar.newConversation": "New Conversation",
  "sidebar.signOut": "Sign Out",

  // TopNav
  "topnav.home": "Home",
  "topnav.tips": "Study Tips",
  "topnav.insights": "Insights",
  "topnav.account": "Account",

  // Common buttons
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.confirm": "Confirm",
  "common.loading": "Loading…",
  "common.notYet": "Not yet",
  "common.keepIt": "Keep it",
  "common.discard": "Discard",
  "common.applyChanges": "Apply changes",
  "common.openChat": "Open chat",
  "common.search": "Search…",
  "common.tba": "TBA",

  // Chat
  "chat.empty.title": "What would you like to explore?",
  "chat.empty.body": "Ask me about majors, careers, universities, or your next step.",
  "chat.placeholder": "Ask about majors, careers, universities…",
  "chat.send": "Send",
  "chat.advisor": "Advisor AI",
  "chat.quickReply.tellMore": "Tell me more",
  "chat.quickReply.majors": "What majors fit this?",
  "chat.quickReply.universities": "Which universities?",
  "chat.quickReply.skills": "Skills I should build",
  "chat.accept": "Accept this schedule",
  "chat.acceptDialog.title": "Save this schedule?",
  "chat.acceptDialog.summary": "{count} courses, {credits} credits. Replaces any schedule you've previously accepted for the current semester.",
  "chat.acceptDialog.confirm": "Save schedule",
  "chat.toast.saved": "Saved to My Schedule",

  // My Schedule
  "myschedule.eyebrow": "ACCEPTED FOR THIS SEMESTER",
  "myschedule.heading": "My Schedule",
  "myschedule.subheading": "Your accepted picks for the current semester. Edit or discard with the advisor.",
  "myschedule.summary": "{count} courses · {credits} credits",
  "myschedule.editInChat": "Edit in chat",
  "myschedule.discard": "Discard",
  "myschedule.editPrompt": "I want to change my schedule",
  "myschedule.empty.title": "No schedule accepted yet",
  "myschedule.empty.body": "Build a schedule with the advisor and click Accept. It'll be saved here.",
  "myschedule.discardDialog.title": "Discard your schedule?",
  "myschedule.discardDialog.body": "This removes all {count} accepted picks for the current semester. You can build a new one in chat.",
  "myschedule.instructorTBA": "Instructor TBA",
  "myschedule.roomTBA": "Room TBA",
  "myschedule.roomLabel": "Room {name}",

  // Semester Schedule
  "semester.eyebrowOfferings": "{semester} OFFERINGS",
  "semester.eyebrowDefault": "OFFERINGS",
  "semester.heading": "Semester Schedule",
  "semester.subheading": "Every class the university is offering this semester — room, instructor, time, and how many students are already enrolled.",
  "semester.searchPlaceholder": "Search by course, instructor, or room…",
  "semester.allDays": "All days",
  "semester.stat.sections": "Sections",
  "semester.stat.courses": "Courses",
  "semester.stat.showing": "Showing",
  "semester.empty.title": "No catalog available yet",
  "semester.empty.body": "Sign in with a seeded test student to see the fixture catalog. Production catalogs will be wired to Supabase in a follow-up.",
  "semester.seatsLeft": "{count} left",
  "semester.noResults": "No sections match the filter.",

  // Study Tips
  "tips.eyebrow": "PER-COURSE GUIDANCE",
  "tips.heading": "Study Tips",
  "tips.subheading": "Tips for the courses you've accepted into your schedule. Better tips come from a richer profile and the advisor.",
  "tips.empty.title": "No accepted schedule yet",
  "tips.empty.body": "Build a schedule with the advisor and accept it. Tips will appear here for each course you're taking.",
  "tips.askMore": "Ask the advisor for more →",
  "tips.askPromptTemplate": "Give me focused study tips for {course}.",
  "tips.generic.0": "Skim the syllabus the night before each lecture and write down one question.",
  "tips.generic.1": "Re-do every solved example in the textbook from scratch on a blank page.",
  "tips.generic.2": "Form a 2–3 person study group; teach the chapter aloud to each other weekly.",
  "tips.generic.3": "Schedule one 25-minute review session within 24 hours of each lecture.",
  "tips.creditSuffix": "cr",

  // Profile
  "profile.eyebrow": "YOUR PROFILE",
  "profile.heading": "Tell me who you are",
  "profile.subheading": "The more I know about your interests and goals, the sharper my recommendations become. You can update any field at any time.",
  "profile.save": "Save profile",
  "profile.saved": "Profile saved.",
  "profile.section.identity": "Identity",
  "profile.section.story": "A bit about you",
  "profile.section.interests": "Interests",
  "profile.section.skills": "Skills",
  "profile.section.countries": "Preferred countries",
  "profile.section.grades": "Academic record (optional)",
  "profile.field.fullName": "Full name",
  "profile.field.educationLevel": "Education level",
  "profile.field.bio": "Short bio",
  "profile.field.gpa": "Current GPA (out of 4.0)",
  "profile.field.interestsLabel": "What excites you academically?",
  "profile.field.interestsPlaceholder": "Add an interest and press Enter",
  "profile.field.skillsLabel": "Skills you already have",
  "profile.field.skillsPlaceholder": "Add a skill and press Enter",
  "profile.field.countriesLabel": "Where would you like to study?",
  "profile.field.countriesPlaceholder": "Add a country and press Enter",
  "profile.tracker.eyebrow": "COURSE PROGRESS",
  "profile.tracker.heading": "Your transcript",
  "profile.tracker.subheading": "Mark passed and currently-enrolled courses so the advisor knows what prerequisites you've cleared.",
  "profile.tracker.subheadingReadOnly": "Your transcript from the test fixture. Fixture students are read-only here.",
  "profile.lang.eyebrow": "LANGUAGE / اللغة",
  "profile.lang.heading": "Display language",
  "profile.lang.subheading": "Switches the entire app and how the advisor replies to you.",
  "profile.lang.english": "English",
  "profile.lang.arabic": "العربية",

  // Tracker
  "tracker.search": "Search course…",
  "tracker.filter.all": "All",
  "tracker.filter.passed": "Passed",
  "tracker.filter.enrolled": "Enrolled",
  "tracker.filter.none": "Not started",
  "tracker.status.passed": "Passed",
  "tracker.status.enrolled": "Enrolled",
  "tracker.status.failed": "Failed",
  "tracker.status.withdrawn": "Withdrawn",
  "tracker.status.empty": "—",
  "tracker.empty": "No courses match the filter.",
  "tracker.grade": "Grade",
  "tracker.semester": "Semester…",
  "tracker.save": "Save",
  "tracker.saved": "✓ Saved",
  "tracker.gradePrefix": "grade",

  // Auth
  "auth.welcomeBack": "Welcome back",
  "auth.signInToContinue": "Sign in to continue your academic journey.",
  "auth.tagline": "Let's map your academic path, together.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create an account",
  "auth.createAccount": "Create account",
  "auth.noAccount": "New here?",
  "auth.haveAccount": "Already have an account?",
  "auth.signUpHere": "Create an account",
  "auth.signInHere": "Sign in",
  "auth.fullName": "Full name",
  "auth.confirmEmail": "Account created! Check your inbox for a confirmation link before signing in.",
};

const ar: Dict = {
  "brand.name": "Smart Advisor",
  "brand.tagline": "مستشارك الأكاديمي بالذكاء الاصطناعي",

  "sidebar.chat": "الدردشة",
  "sidebar.mySchedule": "جدولي",
  "sidebar.semester": "جدول الفصل",
  "sidebar.profile": "الملف الشخصي",
  "sidebar.tips": "نصائح الدراسة",
  "sidebar.history": "السجل",
  "sidebar.newConversation": "محادثة جديدة",
  "sidebar.signOut": "تسجيل الخروج",

  "topnav.home": "الرئيسية",
  "topnav.tips": "نصائح الدراسة",
  "topnav.insights": "إحصاءات",
  "topnav.account": "الحساب",

  "common.cancel": "إلغاء",
  "common.save": "حفظ",
  "common.confirm": "تأكيد",
  "common.loading": "جارٍ التحميل…",
  "common.notYet": "ليس الآن",
  "common.keepIt": "احتفظ به",
  "common.discard": "حذف",
  "common.applyChanges": "تطبيق التغييرات",
  "common.openChat": "فتح الدردشة",
  "common.search": "بحث…",
  "common.tba": "غير محدد",

  "chat.empty.title": "ماذا تود أن تستكشف؟",
  "chat.empty.body": "اسألني عن التخصصات أو المسارات المهنية أو الجامعات أو خطوتك القادمة.",
  "chat.placeholder": "اسأل عن التخصصات أو المسارات المهنية أو الجامعات…",
  "chat.send": "إرسال",
  "chat.advisor": "المستشار الذكي",
  "chat.quickReply.tellMore": "أخبرني المزيد",
  "chat.quickReply.majors": "ما التخصصات المناسبة؟",
  "chat.quickReply.universities": "أي جامعات؟",
  "chat.quickReply.skills": "ما المهارات التي يجب أن أبنيها؟",
  "chat.accept": "قبول هذا الجدول",
  "chat.acceptDialog.title": "هل تريد حفظ هذا الجدول؟",
  "chat.acceptDialog.summary": "{count} مواد، {credits} ساعة معتمدة. سيستبدل أي جدول حفظته سابقًا لهذا الفصل.",
  "chat.acceptDialog.confirm": "حفظ الجدول",
  "chat.toast.saved": "تم الحفظ في جدولي",

  "myschedule.eyebrow": "تم قبوله لهذا الفصل",
  "myschedule.heading": "جدولي",
  "myschedule.subheading": "المواد التي قبلتها لهذا الفصل. عدّلها أو احذفها مع المستشار.",
  "myschedule.summary": "{count} مواد · {credits} ساعة معتمدة",
  "myschedule.editInChat": "تعديل عبر الدردشة",
  "myschedule.discard": "حذف",
  "myschedule.editPrompt": "أريد تغيير جدولي",
  "myschedule.empty.title": "لم تقبل أي جدول بعد",
  "myschedule.empty.body": "اطلب من المستشار بناء جدول واضغط على قبول. سيتم حفظه هنا.",
  "myschedule.discardDialog.title": "هل تريد حذف جدولك؟",
  "myschedule.discardDialog.body": "سيؤدي هذا إلى إزالة جميع المواد الـ{count} المقبولة لهذا الفصل. يمكنك بناء جدول جديد عبر الدردشة.",
  "myschedule.instructorTBA": "المدرّس غير محدد",
  "myschedule.roomTBA": "القاعة غير محددة",
  "myschedule.roomLabel": "قاعة {name}",

  "semester.eyebrowOfferings": "مساقات {semester}",
  "semester.eyebrowDefault": "المساقات",
  "semester.heading": "جدول الفصل",
  "semester.subheading": "جميع المواد التي تطرحها الجامعة هذا الفصل — القاعة والمدرّس والوقت وعدد الطلاب المسجلين.",
  "semester.searchPlaceholder": "ابحث بالمادة أو المدرّس أو القاعة…",
  "semester.allDays": "كل الأيام",
  "semester.stat.sections": "الشُّعب",
  "semester.stat.courses": "المواد",
  "semester.stat.showing": "المعروض",
  "semester.empty.title": "لا يوجد جدول متاح بعد",
  "semester.empty.body": "سجّل الدخول بحساب طالب تجريبي لرؤية الجدول. سيتم ربط البيانات الإنتاجية بقاعدة البيانات لاحقًا.",
  "semester.seatsLeft": "{count} متبقٍّ",
  "semester.noResults": "لا توجد شُعب تطابق الفلتر.",

  "tips.eyebrow": "إرشادات لكل مادة",
  "tips.heading": "نصائح الدراسة",
  "tips.subheading": "نصائح للمواد التي قبلتها في جدولك. كلما اكتمل ملفك وزاد تواصلك مع المستشار، تحسّنت النصائح.",
  "tips.empty.title": "لا يوجد جدول مقبول بعد",
  "tips.empty.body": "ابنِ جدولك مع المستشار واقبَلْه. ستظهر النصائح هنا لكل مادة تأخذها.",
  "tips.askMore": "اسأل المستشار للمزيد ←",
  "tips.askPromptTemplate": "أعطني نصائح دراسية مركّزة لمادة {course}.",
  "tips.generic.0": "اطّلع على الخطة الدراسية ليلة كل محاضرة، ودوّن سؤالًا واحدًا.",
  "tips.generic.1": "أعد حلّ كل مثال في الكتاب من البداية على ورقة بيضاء.",
  "tips.generic.2": "كوّن مجموعة دراسية من 2–3 أشخاص؛ ولّخصوا كل فصل بصوت عالٍ أسبوعيًا.",
  "tips.generic.3": "خصص جلسة مراجعة 25 دقيقة خلال 24 ساعة من كل محاضرة.",
  "tips.creditSuffix": "س.م.",

  "profile.eyebrow": "ملفك الشخصي",
  "profile.heading": "أخبرني عن نفسك",
  "profile.subheading": "كلما عرفت أكثر عن اهتماماتك وأهدافك، تحسّنت توصياتي. يمكنك تحديث أي حقل في أي وقت.",
  "profile.save": "حفظ الملف الشخصي",
  "profile.saved": "تم حفظ الملف.",
  "profile.section.identity": "الهوية",
  "profile.section.story": "نبذة عنك",
  "profile.section.interests": "الاهتمامات",
  "profile.section.skills": "المهارات",
  "profile.section.countries": "الدول المفضّلة",
  "profile.section.grades": "السجل الأكاديمي (اختياري)",
  "profile.field.fullName": "الاسم الكامل",
  "profile.field.educationLevel": "المرحلة الدراسية",
  "profile.field.bio": "نبذة مختصرة",
  "profile.field.gpa": "المعدل التراكمي (من 4.0)",
  "profile.field.interestsLabel": "ما الذي يثير اهتمامك أكاديميًا؟",
  "profile.field.interestsPlaceholder": "أضف اهتمامًا ثم اضغط Enter",
  "profile.field.skillsLabel": "المهارات التي لديك بالفعل",
  "profile.field.skillsPlaceholder": "أضف مهارة ثم اضغط Enter",
  "profile.field.countriesLabel": "أين تودّ الدراسة؟",
  "profile.field.countriesPlaceholder": "أضف دولة ثم اضغط Enter",
  "profile.tracker.eyebrow": "تقدم المواد",
  "profile.tracker.heading": "السجل الأكاديمي",
  "profile.tracker.subheading": "حدّد المواد التي اجتزتها أو المسجَّل بها حاليًا حتى يعرف المستشار ما اجتزته من المتطلبات.",
  "profile.tracker.subheadingReadOnly": "سجلك من البيانات التجريبية. لا يمكن تعديله للطلاب التجريبيين.",
  "profile.lang.eyebrow": "اللغة / Language",
  "profile.lang.heading": "لغة العرض",
  "profile.lang.subheading": "تبدّل التطبيق بأكمله، ولغة ردود المستشار أيضًا.",
  "profile.lang.english": "English",
  "profile.lang.arabic": "العربية",

  "tracker.search": "ابحث عن مادة…",
  "tracker.filter.all": "الكل",
  "tracker.filter.passed": "مجتاز",
  "tracker.filter.enrolled": "مسجَّل",
  "tracker.filter.none": "لم يبدأ",
  "tracker.status.passed": "مجتاز",
  "tracker.status.enrolled": "مسجَّل",
  "tracker.status.failed": "راسب",
  "tracker.status.withdrawn": "منسحب",
  "tracker.status.empty": "—",
  "tracker.empty": "لا توجد مواد تطابق الفلتر.",
  "tracker.grade": "العلامة",
  "tracker.semester": "الفصل…",
  "tracker.save": "حفظ",
  "tracker.saved": "✓ محفوظ",
  "tracker.gradePrefix": "العلامة",

  "auth.welcomeBack": "أهلًا بعودتك",
  "auth.signInToContinue": "سجّل الدخول لمتابعة رحلتك الأكاديمية.",
  "auth.tagline": "لنرسم مسارك الأكاديمي معًا.",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.signIn": "تسجيل الدخول",
  "auth.signUp": "إنشاء حساب",
  "auth.createAccount": "إنشاء الحساب",
  "auth.noAccount": "مستخدم جديد؟",
  "auth.haveAccount": "لديك حساب بالفعل؟",
  "auth.signUpHere": "أنشئ حسابًا",
  "auth.signInHere": "سجّل الدخول",
  "auth.fullName": "الاسم الكامل",
  "auth.confirmEmail": "تم إنشاء الحساب! تحقق من بريدك الإلكتروني لرابط التأكيد قبل تسجيل الدخول.",
};

export const dict = { en, ar } satisfies Record<Lang, Dict>;

/** Translate a key. Falls back to the English value, then to the key itself. */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const raw = dict[lang]?.[key] ?? dict.en[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name) => {
    const v = params[name];
    return v === undefined ? "" : String(v);
  });
}
