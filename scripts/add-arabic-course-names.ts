/**
 * One-shot: stamps a `course_name_ar` field on every row of
 * lib/advisor/fixtures/data/courses.json. Names are standard Jordanian
 * university terminology. Run once; commit the result. The script is
 * idempotent — re-running just overwrites with the same map.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.join("lib", "advisor", "fixtures", "data", "courses.json");

const arabicByEnglishName: Record<string, string> = {
  "Programming 1": "البرمجة 1",
  "Programming 2": "البرمجة 2",
  "Discrete Mathematics": "الرياضيات المتقطعة",
  "Introduction to Cyber Security": "مقدمة في الأمن السيبراني",
  "Data Structures": "هياكل البيانات",
  "Computer Organization": "تنظيم الحاسوب",
  "Networking Fundamentals": "أساسيات الشبكات",
  "Operating Systems": "أنظمة التشغيل",
  "Network Security": "أمن الشبكات",
  "Cryptography": "التشفير",
  "Ethical Hacking": "الاختراق الأخلاقي",
  "Secure Software Development": "تطوير البرمجيات الآمن",
  "Digital Forensics": "التحقيق الجنائي الرقمي",
  "Malware Analysis": "تحليل البرمجيات الخبيثة",
  "Penetration Testing": "اختبار الاختراق",
  "Cyber Security Project": "مشروع الأمن السيبراني",
  "Software Requirements": "متطلبات البرمجيات",
  "Software Design": "تصميم البرمجيات",
  "Database Systems": "أنظمة قواعد البيانات",
  "Software Testing": "اختبار البرمجيات",
  "Web Development": "تطوير الويب",
  "Mobile App Development": "تطوير تطبيقات الهاتف",
  "Software Architecture": "معمارية البرمجيات",
  "DevOps": "ديف أوبس",
  "Software Project Management": "إدارة مشاريع البرمجيات",
  "Linear Algebra": "الجبر الخطي",
  "Probability and Statistics": "الاحتمالات والإحصاء",
  "Data Mining": "التنقيب في البيانات",
  "Machine Learning": "تعلم الآلة",
  "Computer Vision": "الرؤية الحاسوبية",
  "Natural Language Processing": "معالجة اللغة الطبيعية",
  "Deep Learning": "التعلم العميق",
  "Reinforcement Learning": "التعلم المعزز",
  "AI Ethics": "أخلاقيات الذكاء الاصطناعي",
  "Calculus for AI": "التفاضل والتكامل للذكاء الاصطناعي",
  "Research Methods": "مناهج البحث",
  "Technical Writing": "الكتابة التقنية",
  "AI Graduation Project": "مشروع تخرج الذكاء الاصطناعي",
};

const courses = JSON.parse(fs.readFileSync(file, "utf8")) as Array<Record<string, unknown>>;

let missing = 0;
for (const c of courses) {
  const en = c.course_name as string;
  const ar = arabicByEnglishName[en];
  if (!ar) {
    missing++;
    console.warn(`No Arabic name for "${en}" (course_id=${c.course_id})`);
    continue;
  }
  c.course_name_ar = ar;
}

fs.writeFileSync(file, JSON.stringify(courses, null, 2) + "\n");
console.log(
  `Updated ${courses.length - missing}/${courses.length} courses with Arabic names.`
);
if (missing) {
  console.error(`${missing} courses missing translations — fill in arabicByEnglishName.`);
  process.exit(1);
}
