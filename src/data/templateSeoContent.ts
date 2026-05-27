export type TemplateSeoFaqItem = {
  question: string;
  answer: string;
};

export type TemplateSeoEntry = {
  templateId: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  bestFor: string[];
  whatToInclude: string[];
  atsTips: string[];
  writingTips: string[];
  faq: TemplateSeoFaqItem[];
  relatedTemplateIds: string[];
  isPublished: true;
};

export const TEMPLATE_SEO_CONTENT: TemplateSeoEntry[] = [
  {
    templateId: "t040",
    slug: "entry-level-software-engineer-resume",
    seoTitle: "Entry-Level Software Engineer Resume Template | StudiosisLab",
    seoDescription:
      "Use this entry-level software engineer resume template to present projects, internships, and technical skills clearly for ATS and hiring managers.",
    h1: "Entry-Level Software Engineer Resume Template",
    intro:
      "Breaking into software roles usually means proving ability before long job history. This template helps you highlight coding projects, internships, and core skills in a format that reads well in ATS tools and makes sense to technical recruiters.",
    bestFor: [
      "Computer science students and recent graduates applying to SWE roles.",
      "Bootcamp graduates with strong project portfolios and limited full-time experience.",
      "Career changers targeting junior developer openings.",
      "Candidates applying for front-end, back-end, or full-stack entry-level roles.",
    ],
    whatToInclude: [
      "A short summary that states your target role, primary stack, and strengths.",
      "Projects with clear outcomes, tech stack, and links to GitHub or live demos.",
      "Internship or part-time experience with impact-focused bullet points.",
      "Technical skills grouped by languages, frameworks, tools, and databases.",
      "Education, relevant coursework, and certifications if they support the role.",
    ],
    atsTips: [
      "Use job-posting language naturally for core skills like JavaScript, Python, React, SQL, and APIs.",
      "Keep section headings standard: Summary, Skills, Projects, Experience, Education.",
      "Write complete skill names at least once instead of only abbreviations.",
      "Avoid text in images so ATS can parse all key details.",
    ],
    writingTips: [
      "Lead project bullets with action and end with measurable result when possible.",
      "Show engineering thinking, not just tools used: architecture, debugging, testing, deployment.",
      "Keep each bullet specific to one contribution or achievement.",
      "Prioritize recent, relevant projects over unrelated older work.",
    ],
    faq: [
      {
        question: "Should I place projects above work experience?",
        answer:
          "For entry-level software roles, yes if your projects are stronger and more relevant than your experience section.",
      },
      {
        question: "How many projects should I include?",
        answer:
          "Include 2 to 4 strong projects with clear outcomes, responsibilities, and links recruiters can review quickly.",
      },
      {
        question: "Do I need a resume summary as a fresher?",
        answer:
          "A short summary helps when it clearly states your target role, stack, and what you bring to the team.",
      },
    ],
    relatedTemplateIds: ["t043", "t045", "t047"],
    isPublished: true,
  },
  {
    templateId: "t041",
    slug: "registered-nurse-resume",
    seoTitle: "Registered Nurse Resume Template | StudiosisLab",
    seoDescription:
      "Create a registered nurse resume that highlights clinical experience, patient care outcomes, licenses, and certifications in a clean ATS-friendly format.",
    h1: "Registered Nurse Resume Template",
    intro:
      "Nursing resumes need to show both clinical capability and dependable patient care. This template is structured to surface licenses, certifications, and unit-specific experience so employers can quickly see fit for RN positions.",
    bestFor: [
      "Registered nurses applying to hospital, clinic, and outpatient roles.",
      "RNs moving between specialties such as med-surg, ICU, or emergency care.",
      "Nurses with travel, per-diem, or multi-facility experience.",
      "Recent nursing graduates applying to entry-level RN openings.",
    ],
    whatToInclude: [
      "RN licensure details and active certifications such as BLS or ACLS.",
      "Clinical experience with patient population, unit type, and shift environment.",
      "Evidence of patient outcomes, safety protocol compliance, and collaboration.",
      "Medication administration, charting systems, and relevant medical tools.",
      "Education, clinical rotations, and continuing education coursework.",
    ],
    atsTips: [
      "Match specialty keywords from the posting, such as telemetry, triage, or discharge planning.",
      "Use full terms and abbreviations where appropriate, for example Electronic Health Record (EHR).",
      "List credentials consistently to avoid ATS mismatch across sections.",
      "Keep date formats and job titles clean and readable.",
    ],
    writingTips: [
      "Focus on patient care scope, not only task lists.",
      "Quantify workload where useful, such as average patient ratios or case volume.",
      "Highlight teamwork with physicians, therapists, and support staff.",
      "Add examples of calm decision-making in high-pressure situations.",
    ],
    faq: [
      {
        question: "Should I include my nursing license number?",
        answer:
          "You can include license state and status. Full license number is optional unless requested by the employer.",
      },
      {
        question: "How do I show nursing outcomes on a resume?",
        answer:
          "Use practical metrics like reduced readmissions, improved handoff accuracy, or patient education completion rates when available.",
      },
      {
        question: "Do new RNs need a separate clinical rotations section?",
        answer:
          "Yes, especially if professional RN experience is limited. Clinical rotations help demonstrate readiness for patient care settings.",
      },
    ],
    relatedTemplateIds: ["t046", "t044", "t048"],
    isPublished: true,
  },
  {
    templateId: "t042",
    slug: "project-manager-resume",
    seoTitle: "Project Manager Resume Template | StudiosisLab",
    seoDescription:
      "Build a project manager resume that shows delivery outcomes, stakeholder leadership, timelines, budgets, and risk management in an ATS-ready layout.",
    h1: "Project Manager Resume Template",
    intro:
      "Project management resumes perform best when they show results, not just responsibilities. This template helps you present delivery metrics, team coordination, and stakeholder communication in a format that hiring managers can scan quickly.",
    bestFor: [
      "Project managers in technology, operations, or cross-functional business teams.",
      "PMs transitioning from coordinator or analyst roles.",
      "Candidates applying to Agile, hybrid, or waterfall project environments.",
      "Professionals managing budgets, timelines, and multi-team execution.",
    ],
    whatToInclude: [
      "A concise summary with domain focus and years of project delivery experience.",
      "Project highlights with scope, budget range, timeline, and business impact.",
      "Methods and tools such as Agile, Scrum, Jira, Asana, or MS Project.",
      "Stakeholder and team management examples across functions.",
      "Certifications like PMP, CAPM, or Scrum credentials when applicable.",
    ],
    atsTips: [
      "Reflect target-job terms like risk management, roadmap, sprint planning, or vendor management.",
      "Use standard headings so ATS systems can classify your experience correctly.",
      "Include both strategic and execution keywords across summary and bullets.",
      "Avoid overusing jargon if a plain term communicates the same point.",
    ],
    writingTips: [
      "Use result-first bullets: what was delivered, by when, and with what impact.",
      "Show decision-making examples when priorities or scope changed.",
      "Mention cross-team influence, not only direct-report management.",
      "Keep achievements tied to business outcomes such as cost, speed, or quality.",
    ],
    faq: [
      {
        question: "What metrics matter most for a project manager resume?",
        answer:
          "Delivery timelines, budget adherence, risk reduction, and measurable business outcomes are the most useful metrics.",
      },
      {
        question: "Should I list every project?",
        answer:
          "No. Select the most relevant projects and explain them clearly with scope, role, and measurable impact.",
      },
      {
        question: "Do I need a certifications section?",
        answer:
          "Include it if you have recognized PM credentials. It helps recruiters and ATS filters identify your profile quickly.",
      },
    ],
    relatedTemplateIds: ["t045", "t043", "t048"],
    isPublished: true,
  },
  {
    templateId: "t043",
    slug: "data-analyst-resume",
    seoTitle: "Data Analyst Resume Template | StudiosisLab",
    seoDescription:
      "Use this data analyst resume template to present SQL, dashboards, business insights, and reporting impact in a practical ATS-friendly format.",
    h1: "Data Analyst Resume Template",
    intro:
      "Data analyst hiring teams want clear evidence that you can turn raw data into decisions. This template helps you present analysis projects, BI tools, and business outcomes without clutter.",
    bestFor: [
      "Data analysts working with SQL, spreadsheets, and BI dashboards.",
      "Analysts applying for reporting, product analytics, or operations analytics roles.",
      "Junior analysts moving from internship or trainee positions.",
      "Professionals transitioning from finance or business operations into analytics.",
    ],
    whatToInclude: [
      "Core analytics stack including SQL, Excel, Python or R, and dashboard tools.",
      "Projects or work examples that connect analysis to business outcomes.",
      "Metrics ownership such as conversion, retention, forecasting, or reporting accuracy.",
      "Data cleaning, validation, and quality-control responsibilities.",
      "Education, certificates, and domain knowledge relevant to the target industry.",
    ],
    atsTips: [
      "Use explicit tool names from the job description, such as Tableau, Power BI, or Looker.",
      "Include both analyst and business terms like KPI, trend analysis, and stakeholder reporting.",
      "Keep project titles descriptive so ATS and recruiters understand context immediately.",
      "Use readable bullet formatting and avoid dense paragraphs.",
    ],
    writingTips: [
      "Pair each analysis activity with a decision or result it supported.",
      "Explain your process briefly: data source, method, finding, action.",
      "Show communication ability through examples of presenting insights to non-technical teams.",
      "Prioritize quality over quantity in tools listed.",
    ],
    faq: [
      {
        question: "How technical should a data analyst resume be?",
        answer:
          "Technical enough to show your tools and methods, but balanced with business context and outcomes.",
      },
      {
        question: "Should I include portfolio links?",
        answer:
          "Yes, if they are relevant and polished. Portfolio links can strengthen your application when they show real analysis work.",
      },
      {
        question: "What if my experience is mostly academic projects?",
        answer:
          "Academic projects are valid. Frame them with clear problem statements, tools used, and measurable findings.",
      },
    ],
    relatedTemplateIds: ["t040", "t045", "t042"],
    isPublished: true,
  },
  {
    templateId: "t044",
    slug: "customer-service-representative-resume",
    seoTitle: "Customer Service Representative Resume Template | StudiosisLab",
    seoDescription:
      "Build a customer service representative resume that highlights communication, issue resolution, service metrics, and CRM experience.",
    h1: "Customer Service Representative Resume Template",
    intro:
      "Customer service resumes should prove reliability, communication, and problem-solving under pressure. This template helps you present support experience, service metrics, and customer outcomes in a straightforward format.",
    bestFor: [
      "Customer service representatives in call center, retail, and online support teams.",
      "Support professionals applying for inbound or outbound service roles.",
      "Candidates moving from frontline service jobs into office-based support.",
      "Entry-level applicants with strong communication and service experience.",
    ],
    whatToInclude: [
      "A summary focused on customer communication and resolution strengths.",
      "Experience bullets with ticket volume, handle time, CSAT, or resolution rate metrics.",
      "Systems and tools such as CRM, chat support, and knowledge base software.",
      "Examples of handling escalations and de-escalating difficult conversations.",
      "Training, certifications, or language skills that improve service quality.",
    ],
    atsTips: [
      "Mirror role terms like customer support, call handling, escalation, and retention.",
      "Use recognized section names so ATS can parse your work history correctly.",
      "Include both soft skills and system skills in separate sections.",
      "Avoid uncommon abbreviations without full names.",
    ],
    writingTips: [
      "Use specific examples of how you solved customer problems.",
      "Show consistency by mentioning repeatable service metrics.",
      "Highlight teamwork with supervisors and cross-functional partners.",
      "Keep language clear, practical, and outcome-focused.",
    ],
    faq: [
      {
        question: "Do I need metrics on a customer service resume?",
        answer:
          "Yes. Metrics like customer satisfaction, response time, or first-contact resolution help validate your impact.",
      },
      {
        question: "Can I apply without direct call center experience?",
        answer:
          "Yes. Transferable experience from retail, hospitality, or front-desk roles can be strong when framed around customer outcomes.",
      },
      {
        question: "Should I include communication skills in the summary?",
        answer:
          "Yes, but pair them with practical examples in your experience section.",
      },
    ],
    relatedTemplateIds: ["t049", "t046", "t048"],
    isPublished: true,
  },
  {
    templateId: "t045",
    slug: "business-analyst-resume",
    seoTitle: "Business Analyst Resume Template | StudiosisLab",
    seoDescription:
      "Use this business analyst resume template to show requirements gathering, process improvement, stakeholder alignment, and measurable business results.",
    h1: "Business Analyst Resume Template",
    intro:
      "Business analyst hiring teams look for clarity in how you turn business needs into executable solutions. This template helps you present requirement work, process improvements, and cross-team collaboration with practical detail.",
    bestFor: [
      "Business analysts working on process, product, or operations initiatives.",
      "Professionals transitioning from QA, project coordination, or operations roles.",
      "Analysts supporting software delivery and business transformation projects.",
      "Candidates applying to BA roles in finance, healthcare, retail, or tech.",
    ],
    whatToInclude: [
      "Summary of domain expertise and analysis strengths.",
      "Examples of requirement elicitation, documentation, and stakeholder workshops.",
      "Process mapping or workflow redesign outcomes tied to efficiency gains.",
      "Tools and methods such as user stories, SQL, dashboards, or BPMN documentation.",
      "Collaboration with product, engineering, operations, and leadership teams.",
    ],
    atsTips: [
      "Use language from postings: requirements gathering, gap analysis, UAT, process improvement.",
      "Include both technical and business-facing terms for balanced relevance.",
      "Structure sections cleanly so ATS can recognize skills and accomplishments.",
      "List software tools with complete names where possible.",
    ],
    writingTips: [
      "Describe the business problem first, then your analysis approach and outcome.",
      "Quantify impact with metrics such as cycle time reduction or error reduction.",
      "Use concise bullets that show ownership and communication.",
      "Prioritize achievements that demonstrate cross-functional influence.",
    ],
    faq: [
      {
        question: "How is a business analyst resume different from a data analyst resume?",
        answer:
          "Business analyst resumes focus more on requirements, processes, and stakeholder alignment, while data analyst resumes center more on technical analysis and reporting.",
      },
      {
        question: "Should I include SQL on a business analyst resume?",
        answer:
          "Include SQL if you actively use it for analysis, validation, or reporting and it supports the target role.",
      },
      {
        question: "Is UAT experience important to highlight?",
        answer:
          "Yes. UAT involvement shows practical ownership from requirements through solution validation.",
      },
    ],
    relatedTemplateIds: ["t042", "t043", "t048"],
    isPublished: true,
  },
  {
    templateId: "t046",
    slug: "teacher-resume",
    seoTitle: "Teacher Resume Template | StudiosisLab",
    seoDescription:
      "Create a teacher resume that highlights classroom management, lesson planning, student progress, and certifications in an organized format.",
    h1: "Teacher Resume Template",
    intro:
      "A strong teacher resume should quickly communicate classroom impact, curriculum planning, and student support. This template helps educators show instructional strengths and practical results in a clean, readable layout.",
    bestFor: [
      "K-12 teachers applying for public or private school roles.",
      "Educators changing grade levels or subject specialization.",
      "New teachers preparing applications after student teaching.",
      "Teachers seeking roles that combine instruction and student mentoring.",
    ],
    whatToInclude: [
      "Teaching summary with grade levels, subjects, and years of experience.",
      "Classroom achievements such as student performance gains or engagement improvements.",
      "Lesson planning, assessment strategy, and curriculum alignment examples.",
      "Classroom management and parent communication highlights.",
      "Licensure, certifications, and professional development.",
    ],
    atsTips: [
      "Use role-specific terms such as differentiated instruction, classroom management, and formative assessment.",
      "Include grade bands and subject areas in your experience entries.",
      "Keep credential names clear for quick ATS matching.",
      "Avoid decorative formatting that can hide important text.",
    ],
    writingTips: [
      "Focus on student outcomes and teaching approach, not only duties.",
      "Show how you adapted instruction for diverse learning needs.",
      "Include collaboration with counselors, administrators, and families.",
      "Use concise examples of classroom impact.",
    ],
    faq: [
      {
        question: "Should teachers include classroom metrics on resumes?",
        answer:
          "Yes, when available. Metrics such as improved assessment scores or attendance trends help show measurable impact.",
      },
      {
        question: "Can substitute teaching experience be included?",
        answer:
          "Yes. Include it when it demonstrates grade-level coverage, adaptability, and classroom leadership.",
      },
      {
        question: "Where should I place teaching certifications?",
        answer:
          "Place certifications in a dedicated section near the top if they are required for the role.",
      },
    ],
    relatedTemplateIds: ["t041", "t044", "t048"],
    isPublished: true,
  },
  {
    templateId: "t047",
    slug: "cybersecurity-analyst-resume",
    seoTitle: "Cybersecurity Analyst Resume Template | StudiosisLab",
    seoDescription:
      "Build a cybersecurity analyst resume that shows threat detection, incident response, SIEM work, and security controls in an ATS-friendly structure.",
    h1: "Cybersecurity Analyst Resume Template",
    intro:
      "Cybersecurity roles require a resume that demonstrates technical depth and practical risk reduction. This template helps you present incident response, monitoring, and control implementation in a way that security teams can evaluate quickly.",
    bestFor: [
      "Cybersecurity analysts in SOC, detection, and incident response roles.",
      "IT professionals transitioning into security analyst positions.",
      "Candidates with hands-on SIEM, vulnerability, and log analysis experience.",
      "Analysts applying for roles tied to compliance and security operations.",
    ],
    whatToInclude: [
      "Security summary with focus areas such as monitoring, threat analysis, or response.",
      "Hands-on tools and platforms like SIEM, EDR, IAM, and vulnerability scanners.",
      "Incident response examples with timeline, severity, and remediation outcomes.",
      "Security controls, policy enforcement, and audit or compliance contributions.",
      "Certifications such as Security+, CEH, CISSP, or cloud security credentials where relevant.",
    ],
    atsTips: [
      "Use exact skill terms from postings, including SOC, SIEM, incident response, and threat intelligence.",
      "Include both technical controls and governance language when role requires both.",
      "Expand acronyms at least once for ATS readability.",
      "Use clear chronology for security roles and projects.",
    ],
    writingTips: [
      "Show what threats you handled and how your actions reduced risk.",
      "Balance technical detail with business impact and communication.",
      "Highlight collaboration with IT, compliance, and leadership teams.",
      "Use concise bullets that emphasize ownership and outcomes.",
    ],
    faq: [
      {
        question: "Should I include a home lab on a cybersecurity resume?",
        answer:
          "Yes, if it demonstrates practical skills relevant to the role and you can explain your setup and findings clearly.",
      },
      {
        question: "Are certifications enough without experience?",
        answer:
          "Certifications help, but pairing them with projects, labs, or internship work gives recruiters stronger evidence of readiness.",
      },
      {
        question: "How do I show incident response work on a resume?",
        answer:
          "Summarize the incident type, your role, tools used, and the remediation or prevention outcome.",
      },
    ],
    relatedTemplateIds: ["t040", "t043", "t045"],
    isPublished: true,
  },
  {
    templateId: "t048",
    slug: "human-resources-resume",
    seoTitle: "Human Resources Resume Template | StudiosisLab",
    seoDescription:
      "Use this human resources resume template to present recruiting, onboarding, employee relations, HR systems, and policy execution clearly.",
    h1: "Human Resources Resume Template",
    intro:
      "Human resources resumes should show people operations impact, not just process ownership. This template helps you communicate hiring support, onboarding execution, and employee-focused outcomes in a practical structure.",
    bestFor: [
      "HR generalists, HR coordinators, and people operations professionals.",
      "Recruitment-focused candidates applying for broader HR roles.",
      "HR professionals supporting compliance, employee relations, and onboarding.",
      "Candidates transitioning into HR from administrative or operations backgrounds.",
    ],
    whatToInclude: [
      "Summary of HR scope, including recruiting, onboarding, and employee support.",
      "Work achievements tied to hiring cycle time, retention, or process quality.",
      "Experience with HRIS, applicant tracking systems, and reporting workflows.",
      "Policy communication, documentation, and compliance-related responsibilities.",
      "Relevant certifications such as SHRM or PHR where applicable.",
    ],
    atsTips: [
      "Match job-specific terms like talent acquisition, onboarding, employee relations, and HRIS.",
      "Use clear section labels for skills, experience, and certifications.",
      "Include both operational and people-facing competencies.",
      "Avoid broad keyword lists that are not supported by experience.",
    ],
    writingTips: [
      "Use examples that connect HR work to team and business outcomes.",
      "Show discretion and communication strengths through realistic achievements.",
      "Demonstrate process improvement and consistency in HR operations.",
      "Keep each bullet focused on one responsibility and one result.",
    ],
    faq: [
      {
        question: "What metrics are useful on an HR resume?",
        answer:
          "Hiring cycle time, onboarding completion rates, retention trends, and policy compliance improvements are useful when accurate.",
      },
      {
        question: "Should I list every HR tool I have seen?",
        answer:
          "List tools you can confidently use in a new role, especially those requested in the job posting.",
      },
      {
        question: "Can recruiting experience support a generalist role application?",
        answer:
          "Yes. Emphasize transferable work such as interviewing, onboarding, and stakeholder coordination.",
      },
    ],
    relatedTemplateIds: ["t045", "t042", "t044"],
    isPublished: true,
  },
  {
    templateId: "t049",
    slug: "warehouse-worker-resume",
    seoTitle: "Warehouse Worker Resume Template | StudiosisLab",
    seoDescription:
      "Create a warehouse worker resume that highlights safety, inventory accuracy, equipment handling, and productivity metrics in a clear format.",
    h1: "Warehouse Worker Resume Template",
    intro:
      "Warehouse hiring managers usually scan resumes for reliability, safety habits, and pace. This template helps you present inventory work, equipment experience, and shift performance clearly for quick review.",
    bestFor: [
      "Warehouse associates applying for picking, packing, receiving, or shipping roles.",
      "Candidates with forklift or pallet jack experience.",
      "Workers moving into higher-responsibility warehouse positions.",
      "Entry-level applicants with logistics, retail stockroom, or fulfillment experience.",
    ],
    whatToInclude: [
      "Summary with shift readiness, safety focus, and warehouse strengths.",
      "Experience bullets covering receiving, inventory checks, order picking, and shipping support.",
      "Equipment and systems such as forklifts, scanners, or warehouse management tools.",
      "Productivity and quality outcomes like order accuracy or on-time throughput.",
      "Safety training, certifications, or compliance practices.",
    ],
    atsTips: [
      "Use posting keywords naturally, including inventory, shipping, receiving, and forklift.",
      "Include measurable details such as volume handled per shift when available.",
      "Use standard headings so ATS can parse your work history and skills.",
      "Keep formatting simple with clear bullets and dates.",
    ],
    writingTips: [
      "Emphasize safety consistency and attention to detail.",
      "Show reliability with attendance, shift flexibility, or cross-team support examples.",
      "Use concise bullets that explain both task and result.",
      "Highlight physical and operational readiness without exaggeration.",
    ],
    faq: [
      {
        question: "Should I mention physical capability on my resume?",
        answer:
          "You can mention role-relevant readiness, such as lifting requirements and shift work, in a factual and professional way.",
      },
      {
        question: "Do warehouse resumes need metrics?",
        answer:
          "Yes. Metrics like pick rate, order accuracy, and shipping volume can strengthen your application.",
      },
      {
        question: "Is forklift certification important to list?",
        answer:
          "Yes, if you have it. Put it in a visible section because many warehouse roles prioritize certified operators.",
      },
    ],
    relatedTemplateIds: ["t044", "t048", "t046"],
    isPublished: true,
  },
];
