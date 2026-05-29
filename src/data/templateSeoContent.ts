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
  {
    templateId: "t050",
    slug: "it-support-specialist-resume",
    seoTitle: "IT Support Specialist Resume Template | StudiosisLab",
    seoDescription:
      "ATS-friendly IT support resume template focused on troubleshooting, help desk workflows, technical support, and end-user assistance.",
    h1: "IT Support Specialist Resume Template",
    intro:
      "IT support hiring teams want proof that you can solve technical issues without slowing people down. This template helps you present troubleshooting depth, ticket handling, and user communication in a clean format employers can scan quickly.",
    bestFor: [
      "Help desk specialists supporting office or remote teams.",
      "Desktop support professionals moving into broader IT support roles.",
      "IT technicians handling hardware, software, and account access issues.",
      "Candidates transitioning from general IT operations into support-focused jobs.",
    ],
    whatToInclude: [
      "A summary that covers your support scope, systems familiarity, and service mindset.",
      "Ticketing experience with examples of incident volume, priorities, and response quality.",
      "Troubleshooting responsibilities across devices, operating systems, and core business apps.",
      "Experience with account administration, permissions, and user onboarding support.",
      "Certifications or training such as CompTIA, Microsoft, or role-specific support credentials.",
    ],
    atsTips: [
      "Use the same technical terms listed in job descriptions, such as help desk, ticket triage, and root cause analysis.",
      "Name the tools you use, including ticketing systems, remote support tools, and directory management.",
      "Keep section headings standard so ATS can classify skills, work experience, and certifications correctly.",
      "Write out full product or platform names at least once instead of only abbreviations.",
    ],
    writingTips: [
      "Show how you resolved issues, not just that you answered tickets.",
      "Include user-facing communication examples, especially where you translated technical issues clearly.",
      "Use measurable context when possible, such as resolution time, queue size, or repeat-issue reduction.",
      "Highlight teamwork with security, infrastructure, and business teams where relevant.",
    ],
    faq: [
      {
        question: "Should I include ticket volume on an IT support resume?",
        answer:
          "Yes. Ticket volume, response time, and resolution quality help hiring managers understand your day-to-day workload and effectiveness.",
      },
      {
        question: "Do entry-level IT support resumes need certifications?",
        answer:
          "Certifications can help, but practical support examples and clear troubleshooting results are just as important.",
      },
      {
        question: "How do I show soft skills in a technical support resume?",
        answer:
          "Include short examples of communicating with non-technical users, managing expectations, and resolving issues calmly.",
      },
    ],
    relatedTemplateIds: ["t040", "t047", "t043"],
    isPublished: true,
  },
  {
    templateId: "t051",
    slug: "marketing-manager-resume",
    seoTitle: "Marketing Manager Resume Template | StudiosisLab",
    seoDescription:
      "Professional marketing manager resume template designed for campaign strategy, digital growth, brand management, and ROI-focused resumes.",
    h1: "Marketing Manager Resume Template",
    intro:
      "Marketing manager resumes perform best when they connect strategy to measurable growth. This template is built to help you present campaign leadership, cross-channel performance, and business impact in language hiring teams actually care about.",
    bestFor: [
      "Marketing managers leading integrated campaigns across digital and offline channels.",
      "Growth-focused marketers responsible for leads, conversion, and pipeline outcomes.",
      "Brand and demand generation professionals moving into broader management roles.",
      "Candidates managing agencies, partners, and cross-functional go-to-market execution.",
    ],
    whatToInclude: [
      "A short summary describing your channel strengths, industry focus, and leadership scope.",
      "Campaign achievements with metrics such as pipeline growth, cost efficiency, or return on ad spend.",
      "Team and stakeholder collaboration across creative, sales, product, and analytics functions.",
      "Budget ownership, forecasting, and optimization examples tied to business goals.",
      "Tooling and reporting experience with platforms used for execution and performance analysis.",
    ],
    atsTips: [
      "Use role-specific keywords naturally, including campaign strategy, demand generation, and performance marketing.",
      "Include both strategic language and execution terms so ATS captures your full scope.",
      "Mention channels explicitly, such as email, paid search, social, content, or lifecycle marketing.",
      "Keep metric language consistent and easy to parse in bullet points.",
    ],
    writingTips: [
      "Lead with outcomes first, then explain the campaign actions that created them.",
      "Show how your decisions improved efficiency, quality of leads, or revenue impact.",
      "Balance leadership claims with concrete examples of execution ownership.",
      "Avoid listing every platform unless it supports your target role.",
    ],
    faq: [
      {
        question: "What metrics should a marketing manager include on a resume?",
        answer:
          "Include metrics tied to growth and efficiency, such as lead volume, conversion rate, CAC, ROAS, or campaign-influenced revenue.",
      },
      {
        question: "Should I separate brand and performance marketing experience?",
        answer:
          "Yes, when both are relevant. Distinguishing them helps recruiters quickly see your strategic range.",
      },
      {
        question: "Do marketing managers need to list team size?",
        answer:
          "If you managed people or vendors, include team scope because it adds context to your leadership claims.",
      },
    ],
    relatedTemplateIds: ["t042", "t045", "t054"],
    isPublished: true,
  },
  {
    templateId: "t052",
    slug: "medical-assistant-resume",
    seoTitle: "Medical Assistant Resume Template | StudiosisLab",
    seoDescription:
      "Medical assistant resume template built for clinical support, patient care workflows, scheduling, charting, and healthcare administration.",
    h1: "Medical Assistant Resume Template",
    intro:
      "Medical assistant roles require a careful mix of clinical reliability and front-office coordination. This template helps you show patient-facing support, documentation accuracy, and workflow consistency in a way clinics and healthcare employers can evaluate quickly.",
    bestFor: [
      "Medical assistants working in outpatient clinics, urgent care, or specialty practices.",
      "Candidates balancing clinical support with scheduling and administrative duties.",
      "Certified assistants applying for roles with patient intake and exam-room preparation.",
      "Healthcare support professionals transitioning into full medical assistant positions.",
    ],
    whatToInclude: [
      "A focused summary that reflects your clinical support strengths and patient interaction experience.",
      "Patient intake, vitals, room preparation, and provider support responsibilities.",
      "Charting and records workflows, including EHR usage and documentation accuracy.",
      "Administrative duties such as appointment coordination, follow-up communication, and insurance basics.",
      "Relevant certifications, training, and compliance practices used in daily work.",
    ],
    atsTips: [
      "Use exact role terms from postings, such as patient intake, charting, and clinical support.",
      "Include certification names and credential abbreviations in a consistent format.",
      "List EHR and healthcare systems by full names where possible.",
      "Keep section headings straightforward so ATS can parse clinical and administrative experience clearly.",
    ],
    writingTips: [
      "Demonstrate reliability with specific examples of workflow accuracy and patient support.",
      "Show both clinical and admin contributions instead of focusing on one side only.",
      "Use concise bullets that describe action, context, and practical outcome.",
      "Highlight communication with providers and patients in a professional, factual tone.",
    ],
    faq: [
      {
        question: "Should I include both clinical and front-desk tasks on my resume?",
        answer:
          "Yes. Many medical assistant roles expect both, and showing that range can make your profile more competitive.",
      },
      {
        question: "How should I present EHR experience?",
        answer:
          "Name the systems you used and briefly describe how you handled charting, updates, or documentation workflows.",
      },
      {
        question: "Do medical assistant resumes need certifications at the top?",
        answer:
          "If certification is required for the role, place it in a visible section near the top half of the resume.",
      },
    ],
    relatedTemplateIds: ["t041", "t046", "t044"],
    isPublished: true,
  },
  {
    templateId: "t053",
    slug: "ux-designer-resume",
    seoTitle: "UX Designer Resume Template | StudiosisLab",
    seoDescription:
      "UX designer resume template focused on user research, interaction design, wireframes, prototypes, and product design impact.",
    h1: "UX Designer Resume Template",
    intro:
      "A strong UX resume should make your process and impact easy to understand in seconds. This template helps you communicate research decisions, interaction design work, and collaboration outcomes without overwhelming recruiters with portfolio-only language.",
    bestFor: [
      "UX designers building products for web or mobile experiences.",
      "Designers moving from UI-heavy work into broader user experience roles.",
      "Product designers who combine research, prototyping, and collaboration.",
      "Candidates applying to cross-functional UX roles in startup or enterprise teams.",
    ],
    whatToInclude: [
      "A summary that defines your UX focus, product context, and design strengths.",
      "Project experience showing research methods, design decisions, and user-centered outcomes.",
      "Examples of wireframes, prototypes, usability testing, and iteration cycles.",
      "Collaboration details with product managers, engineers, researchers, and stakeholders.",
      "Portfolio links and selected case studies aligned to the role you are targeting.",
    ],
    atsTips: [
      "Use keywords found in job postings, such as user research, interaction design, prototyping, and usability testing.",
      "Mention core tools and workflows with clear naming, including Figma and prototyping platforms.",
      "Avoid overly stylized section titles that ATS systems may not parse well.",
      "Include both research and execution terms if the role spans end-to-end product design.",
    ],
    writingTips: [
      "Describe design challenges and outcomes, not only deliverables.",
      "Show how your work improved clarity, usability, adoption, or conversion where possible.",
      "Keep bullets tied to one clear decision or contribution each.",
      "Use your portfolio to expand details, and keep resume bullets concise and outcome-focused.",
    ],
    faq: [
      {
        question: "Should a UX resume include a portfolio link in the header?",
        answer:
          "Yes. A clear portfolio link is expected for most UX roles and helps reviewers quickly validate your work.",
      },
      {
        question: "How much research detail should I include on the resume?",
        answer:
          "Include concise highlights of methods and impact, then use case studies for deeper process detail.",
      },
      {
        question: "Can UI-heavy experience still fit a UX designer resume?",
        answer:
          "Yes, if you frame your UI work around user problems, testing insights, and product outcomes.",
      },
    ],
    relatedTemplateIds: ["t040", "t043", "t051"],
    isPublished: true,
  },
  {
    templateId: "t054",
    slug: "sales-associate-resume",
    seoTitle: "Sales Associate Resume Template | StudiosisLab",
    seoDescription:
      "Sales associate resume template that highlights retail sales, customer service, merchandising, and upselling experience.",
    h1: "Sales Associate Resume Template",
    intro:
      "Sales associate resumes should show more than friendliness at the register. This template helps you present customer-facing sales results, floor execution, and day-to-day retail reliability in a practical format for hiring managers.",
    bestFor: [
      "Retail sales associates working on floor sales, customer service, and checkout support.",
      "Candidates applying to store, showroom, or brand-specific sales roles.",
      "Job seekers with upselling, merchandising, and product recommendation experience.",
      "Entry-level applicants with strong customer interaction and sales potential.",
    ],
    whatToInclude: [
      "A concise summary covering sales strengths, customer approach, and store operations experience.",
      "Sales outcomes such as target attainment, upsell conversion, or average transaction value improvements.",
      "Customer support examples including product guidance, issue resolution, and service consistency.",
      "Operational contributions like merchandising, inventory checks, and opening or closing routines.",
      "Point-of-sale and retail systems used for transactions, returns, and stock workflows.",
    ],
    atsTips: [
      "Use role terms from job postings, including sales associate, merchandising, and customer service.",
      "Include measurable sales details where possible instead of generic responsibility lists.",
      "Name POS platforms or retail systems if they are relevant to the target role.",
      "Keep formatting simple and chronological so ATS can parse employment history accurately.",
    ],
    writingTips: [
      "Show how you contributed to revenue, not just that you assisted customers.",
      "Highlight situations where your recommendations improved customer decisions or basket size.",
      "Pair retail operations work with outcomes like shelf readiness or stock accuracy.",
      "Use clear, realistic language and avoid exaggerated performance claims.",
    ],
    faq: [
      {
        question: "What metrics matter most on a sales associate resume?",
        answer:
          "Useful metrics include sales target attainment, upsell rate, conversion contribution, and customer satisfaction indicators.",
      },
      {
        question: "Should I include cashier duties on a sales resume?",
        answer:
          "Yes, if relevant. Frame cashier work with accuracy, speed, and customer service impact.",
      },
      {
        question: "Can I apply for sales associate roles without formal sales titles?",
        answer:
          "Yes. Retail, service, and customer-facing experience can translate well when you show practical sales contributions.",
      },
    ],
    relatedTemplateIds: ["t044", "t049", "t051"],
    isPublished: true,
  },
  {
    templateId: "t055",
    slug: "accountant-resume",
    seoTitle: "Accountant Resume Template | StudiosisLab",
    seoDescription:
      "Accountant resume template focused on bookkeeping, financial reporting, reconciliations, tax support, and accounting software skills.",
    h1: "Accountant Resume Template",
    intro:
      "Hiring teams for accounting roles look for reliable financial accuracy and strong reporting discipline. This template helps you present reconciliations, close-cycle work, and system skills in a clear format that works for ATS screening and hiring manager review.",
    bestFor: [
      "Accountants handling general ledger, reconciliations, and month-end close tasks.",
      "Bookkeeping professionals moving into broader accounting roles.",
      "Candidates supporting AP/AR, payroll coordination, and tax preparation workflows.",
      "Finance team members applying for staff accountant or junior accountant openings.",
    ],
    whatToInclude: [
      "A concise summary showing accounting scope, reporting strengths, and software proficiency.",
      "Hands-on work in reconciliations, journal entries, month-end close, and variance review.",
      "Examples of AP/AR support, invoice workflows, and payment tracking accuracy.",
      "Financial reporting responsibilities, including schedules, statements, and audit prep support.",
      "Tools and certifications such as QuickBooks, Excel, ERP systems, and accounting coursework.",
    ],
    atsTips: [
      "Use role-specific terms naturally, including reconciliations, AP/AR, financial reporting, and month-end close.",
      "Include software names exactly as listed in job posts, such as QuickBooks, Excel, and ERP platforms.",
      "Keep headings standard so ATS can parse accounting experience, skills, and education correctly.",
      "Add both technical keywords and process terms to reflect day-to-day accounting responsibilities.",
    ],
    writingTips: [
      "Show measurable outcomes such as reduced errors, faster close cycles, or reporting accuracy improvements.",
      "Pair accounting tasks with clear context so reviewers understand business impact.",
      "Use concise bullet points that demonstrate consistency, detail orientation, and deadline reliability.",
      "Avoid generic claims and focus on concrete contributions within finance operations.",
    ],
    faq: [
      {
        question: "Which accounting tools should I list on an accountant resume?",
        answer:
          "List tools you actively use, such as QuickBooks, Excel, and relevant ERP systems, especially those requested in the job description.",
      },
      {
        question: "How do I present month-end close experience clearly?",
        answer:
          "Include your specific responsibilities in the close cycle, timelines you supported, and any improvements in speed or accuracy.",
      },
      {
        question: "Should AP/AR work be included for staff accountant roles?",
        answer:
          "Yes. AP/AR ownership or support can strengthen your profile when tied to accuracy, controls, and reporting outcomes.",
      },
    ],
    relatedTemplateIds: ["t023", "t024", "t025", "t026"],
    isPublished: true,
  },
  {
    templateId: "t056",
    slug: "graphic-designer-resume",
    seoTitle: "Graphic Designer Resume Template | StudiosisLab",
    seoDescription:
      "Graphic designer resume template for showcasing branding, visual design, portfolio projects, creative tools, and design impact.",
    h1: "Graphic Designer Resume Template",
    intro:
      "Graphic design resumes work best when creative quality is paired with practical outcomes. This template helps you present branding projects, layout work, and production-ready skills in a way recruiters can scan quickly before opening your portfolio.",
    bestFor: [
      "Graphic designers building brand assets for marketing, product, or editorial teams.",
      "Designers applying to in-house, agency, or freelance-to-full-time roles.",
      "Professionals focused on visual identity, campaign creatives, and digital design systems.",
      "Candidates with portfolio work across print, social, web, and presentation formats.",
    ],
    whatToInclude: [
      "A focused summary describing your design style, core strengths, and project scope.",
      "Portfolio-linked projects with role, deliverables, and measurable design impact.",
      "Examples of branding, layout, typography, and visual hierarchy decisions.",
      "Collaboration details with marketing, content, product, or development teams.",
      "Tool stack such as Adobe Creative Suite, Figma, and production workflow platforms.",
    ],
    atsTips: [
      "Use exact role terms like branding, layout design, typography, and visual communication from job descriptions.",
      "List tool names clearly, including Adobe Illustrator, Photoshop, InDesign, and Figma where relevant.",
      "Include both creative and execution keywords to reflect concept-to-delivery work.",
      "Keep section labels simple so ATS can identify skills, experience, and portfolio context correctly.",
    ],
    writingTips: [
      "Describe what design problem you solved, not just what asset you created.",
      "Use outcome-driven bullets with practical results such as engagement lift or conversion support.",
      "Show range across brand consistency, campaign work, and production accuracy.",
      "Let portfolio links provide depth while resume bullets stay concise and relevant.",
    ],
    faq: [
      {
        question: "Where should portfolio links appear on a graphic designer resume?",
        answer:
          "Place your primary portfolio link near the top and reference relevant project links in the experience section when helpful.",
      },
      {
        question: "Should I list every design tool I have used?",
        answer:
          "List tools you can use confidently in a role and prioritize those mentioned in the target job posting.",
      },
      {
        question: "How can I show design impact on a resume?",
        answer:
          "Pair each project with outcomes such as campaign performance, brand consistency gains, or faster production workflows.",
      },
    ],
    relatedTemplateIds: ["t031", "t032", "t053"],
    isPublished: true,
  },
  {
    templateId: "t057",
    slug: "administrative-assistant-resume",
    seoTitle: "Administrative Assistant Resume Template | StudiosisLab",
    seoDescription:
      "Administrative assistant resume template focused on scheduling, office coordination, communication, documentation, and administrative support.",
    h1: "Administrative Assistant Resume Template",
    intro:
      "Administrative assistant roles depend on precision, communication, and reliable follow-through. This template helps you organize calendar support, documentation, and office coordination achievements into a resume format that is easy for ATS tools and hiring teams to review.",
    bestFor: [
      "Administrative assistants supporting executives, teams, or department operations.",
      "Office coordinators handling scheduling, documentation, and communication workflows.",
      "Candidates moving from customer-facing operations into formal admin support roles.",
      "Professionals applying for assistant roles in healthcare, education, legal, or business offices.",
    ],
    whatToInclude: [
      "A summary that highlights organization, communication, and execution strengths.",
      "Calendar management, meeting coordination, and travel or event support responsibilities.",
      "Documentation and records work, including data entry, filing, and process tracking.",
      "Office operations contributions such as vendor coordination, supply workflows, and follow-ups.",
      "Tools and systems like Microsoft Office, Google Workspace, CRM, and scheduling software.",
    ],
    atsTips: [
      "Use job-post language such as calendar management, office coordination, and administrative support.",
      "Include software skills explicitly, especially Microsoft Office, Google Workspace, and CRM tools.",
      "Keep headings conventional so ATS can parse responsibilities and systems experience accurately.",
      "Add practical workflow terms like documentation, correspondence, and scheduling support.",
    ],
    writingTips: [
      "Show how your support improved team efficiency, scheduling reliability, or documentation quality.",
      "Use concise bullets that combine task ownership with measurable or observable results.",
      "Highlight communication strengths with examples of stakeholder coordination.",
      "Prioritize recent, role-relevant admin experience over broad generic responsibility lists.",
    ],
    faq: [
      {
        question: "What should I prioritize on an administrative assistant resume?",
        answer:
          "Prioritize scheduling, communication, documentation, and office support outcomes that directly match the target role requirements.",
      },
      {
        question: "Do I need to include software tools for admin roles?",
        answer:
          "Yes. Listing tools like Microsoft Office, Google Workspace, and CRM systems helps recruiters quickly assess readiness.",
      },
      {
        question: "How can I make administrative work sound impactful?",
        answer:
          "Focus on outcomes such as smoother scheduling, reduced errors, faster coordination, or improved document handling consistency.",
      },
    ],
    relatedTemplateIds: ["t027", "t028", "t030", "t044"],
    isPublished: true,
  },
];
