/* ==========================================================================
   AXIS COLLEGES OF HIGHER EDUCATION - SITE CONTENT (data/site-data.js)
   --------------------------------------------------------------------------
   This file is the "database" of the website. Every page reads its text,
   courses, notices, events, gallery photos, FAQs, etc. from the object below.

   HOW TO CHANGE CONTENT
   1. Easy way  : Open admin.html (Staff Login), edit anything, then click
                  "Export site-data.js" and replace this file with the download.
   2. Manual way: Edit the values below with a text editor. Keep the commas,
                  quotes and brackets exactly as they are.

   Note: this file is plain JavaScript (window.AXIS_DATA) so the website also
   works by simply double-clicking index.html (no server needed).
   ========================================================================== */

window.AXIS_DATA = {
  version: 2,

  /* ------------------------------------------------------------------
     1. GENERAL SETTINGS (used in header, footer, contact details)
     ------------------------------------------------------------------ */
  settings: {
    collegeName: 'Axis Colleges of Higher Education',
    shortName: 'Axis Colleges',
    tagline: 'Institute of Higher Education • Kanpur, UP',
    address: 'Milestone 478, NH-2, Rooma, Kanpur, Uttar Pradesh — 209402',
    phone: '+91 98390 12345',
    phoneAlt: '+91 93362 88990',
    tollFree: '1800-313-2464',
    email: 'info@axiscolleges.edu.in',
    admissionsEmail: 'admission@axiscolleges.edu.in',
    placementEmail: 'placement@axiscolleges.edu.in',
    officeHours: 'Monday – Saturday: 9:00 AM to 5:00 PM',
    session: '2026–27',
    admissionsOpen: true,
    approvals: 'AICTE Approved • AKTU & CSJMU Affiliated',
    footerNote: 'Committed to excellence in Technical, Management & Professional Education.',

    /* Optional: paste a free form-collection URL here (for example a
       Formspree endpoint like https://formspree.io/f/xxxx). When set, every
       admission, enquiry and event form is ALSO sent to that URL so that the
       college receives it on its own email/dashboard. Leave "" for demo mode. */
    formEndpoint: '',

    /* Password for admin.html. CHANGE THIS before publishing!
       (Client-side protection only - suitable for a college project demo.) */
    adminPassword: 'axis@2026'
  },

  /* ------------------------------------------------------------------
     2. HOME PAGE HERO & TOP-BAR TICKER
     ------------------------------------------------------------------ */
  hero: {
    badge: 'Admissions Open 2026–27 • Merit Scholarships Available',
    title: 'Empowering Future Engineers, Innovators & Leaders',
    subtitle: 'Located across a lush 65-acre campus in Rooma, Kanpur, Axis Colleges combines rigorous academic foundations, modern laboratories, and industry-aligned training to build meaningful careers.',
    image: 'images/campus-hero.jpg',
    primaryText: 'Explore Programs',
    primaryLink: 'courses.html',
    secondaryText: 'Online Admission Form',
    secondaryLink: 'admissions.html'
  },

  /* Scrolling announcements shown in the thin blue bar at the very top */
  tickers: [
    'Admissions Open for Academic Session 2026–27 (B.Tech, BCA, MCA, BBA, MBA & B.Pharm)',
    'AKTU Odd Semester Examination Form portal is open till 15th November 2026',
    'Congratulations to 340+ students placed in TCS, Infosys, Capgemini & Cognizant Drive!',
    'Technovation 2026 — Annual Hackathon & Robotics Expo registrations are now live!'
  ],

  /* Counter cards on the home page. value = number to count up to */
  stats: [
    { label: 'Acres Wi-Fi Enabled Campus', value: 65, suffix: '+' },
    { label: 'Successful Alumni Network', value: 12500, suffix: '+' },
    { label: 'Placement Assistance Track', value: 94, suffix: '%' },
    { label: 'Campus Recruiting Partners', value: 180, suffix: '+' }
  ],

  /* ------------------------------------------------------------------
     3. NOTICE BOARD  (category decides the filter button it appears under)
     date format: YYYY-MM-DD
     ------------------------------------------------------------------ */
  notices: [
    { id: 'n1', category: 'Exams', date: '2026-10-24', title: 'Odd Semester Sessional Test-1 Schedule Released', body: 'B.Tech, BCA & MBA 1st and 3rd semester students can check room seating plans on the department board.' },
    { id: 'n2', category: 'Placements', date: '2026-10-20', title: 'TCS Ninja & Digital Campus Recruitment Registration', body: 'Final year B.Tech (CSE/AI/ECE) & MCA students must register before 30th October with updated resumes.' },
    { id: 'n3', category: 'Events', date: '2026-11-15', title: 'Technovation 2026 — 24-Hour Coding Hackathon & Robotics', body: 'Form teams of 2–4 members and submit project abstracts online via the Campus & Events page.' },
    { id: 'n4', category: 'Scholarship', date: '2026-11-10', title: 'UP Government Post-Matric Scholarship Verification', body: 'Submit hard copies of verified scholarship forms at Admin Counter No. 3 between 10:00 AM and 3:00 PM.' },
    { id: 'n5', category: 'Workshop', date: '2026-11-05', title: 'Pre-Placement Mock Interview & Aptitude Boot Camp', body: 'Mandatory 5-day corporate readiness session conducted by Training & Placement Cell in Seminar Hall B.' }
  ],

  /* ------------------------------------------------------------------
     4. COURSES & FEES
     id      : short unique code (used in links like admissions.html?course=btech-cse)
     stream  : used for the stream filter buttons on the Courses page
     featured: true = shown as a card on the Home page
     fee     : annual tuition in rupees (number only, no commas)
     ------------------------------------------------------------------ */
  courses: [
    { id: 'btech-cse', name: 'B.Tech — Computer Science & Engg. (CSE)', shortName: 'B.Tech CSE', stream: 'Engineering', affiliation: 'AKTU, Lucknow', featured: true, duration: '4 Years', seats: 180, fee: 95000, eligibility: '10+2 (PCM) ≥ 45%', admissionMode: 'JEE / CUET / Merit', description: 'Comprehensive 8-semester program covering DSA, Operating Systems, DBMS, Full-Stack Web Dev, and Cloud Computing.' },
    { id: 'btech-aiml', name: 'B.Tech — Artificial Intelligence & ML', shortName: 'B.Tech AI & ML', stream: 'Engineering', affiliation: 'AKTU, Lucknow', featured: false, duration: '4 Years', seats: 120, fee: 98000, eligibility: '10+2 (PCM) ≥ 45%', admissionMode: 'JEE / CUET / Merit', description: 'Specialized engineering track in Machine Learning, Deep Neural Networks, Python Data Science, and Computer Vision.' },
    { id: 'btech-ece', name: 'B.Tech — Electronics & Comm. (ECE)', shortName: 'B.Tech ECE', stream: 'Engineering', affiliation: 'AKTU, Lucknow', featured: false, duration: '4 Years', seats: 60, fee: 88000, eligibility: '10+2 (PCM) ≥ 45%', admissionMode: 'JEE / Direct Merit', description: 'Focuses on VLSI Design, Embedded Systems, IoT Hardware, Robotics, and Wireless Communication Networks.' },
    { id: 'bca', name: 'BCA — Bachelor of Computer Applications', shortName: 'BCA', stream: 'Computer Apps', affiliation: 'CSJMU, Kanpur', featured: true, duration: '3 Years', seats: 240, fee: 58000, eligibility: '10+2 Any Stream ≥ 45%', admissionMode: 'Direct / Merit Counseling', description: 'Career-oriented undergraduate IT degree focusing on HTML/CSS/JS, Core Java, Python, SQL, and Software Engineering.' },
    { id: 'mca', name: 'MCA — Master of Computer Applications', shortName: 'MCA', stream: 'Computer Apps', affiliation: 'AKTU, Lucknow', featured: false, duration: '2 Years', seats: 120, fee: 76000, eligibility: 'BCA / B.Sc / Grad + Maths', admissionMode: 'CUET-PG / Merit', description: 'Postgraduate program preparing software architects with Advanced Java, Spring, Cloud DevOps, and Capstone Projects.' },
    { id: 'bba', name: 'BBA — Bachelor of Business Administration', shortName: 'BBA', stream: 'Management', affiliation: 'CSJMU, Kanpur', featured: false, duration: '3 Years', seats: 180, fee: 54000, eligibility: '10+2 Any Stream ≥ 45%', admissionMode: 'Merit & Personal Interview', description: 'Foundational business leadership program covering Marketing, Corporate Accounting, Digital Business, and Entrepreneurship.' },
    { id: 'mba', name: 'MBA — Master of Business Administration', shortName: 'MBA', stream: 'Management', affiliation: 'AKTU, Lucknow', featured: true, duration: '2 Years', seats: 120, fee: 85000, eligibility: 'Graduation ≥ 50%', admissionMode: 'CUET-PG / CMAT / Merit', description: 'Dual specialization in Finance, Marketing, HR, IT & Business Analytics with live corporate internships and case studies.' },
    { id: 'bpharm', name: 'B.Pharm — Bachelor of Pharmacy', shortName: 'B.Pharm', stream: 'Pharmacy', affiliation: 'PCI & AKTU', featured: true, duration: '4 Years', seats: 100, fee: 92000, eligibility: '10+2 (PCB/PCM) ≥ 50%', admissionMode: 'CUET / Merit Counseling', description: 'PCI-approved healthcare degree offering training in Pharmaceutics, Medicinal Chemistry, Clinical Research & Quality Assurance.' }
  ],

  /* Merit scholarship slabs: "min" = minimum % needed, "discount" = % waiver.
     Keep this list sorted from highest min to lowest min. */
  feeSlabs: [
    { min: 90, label: '90% and Above', discount: 25 },
    { min: 80, label: '80% to 89.9%', discount: 15 },
    { min: 75, label: '75% to 79.9%', discount: 10 },
    { min: 0, label: 'Below 75%', discount: 0 }
  ],

  /* Hostel / mess options. charge = extra yearly amount in rupees */
  hostelOptions: [
    { id: 'day', label: 'Day Scholar (No Hostel)', charge: 0 },
    { id: 'nonac', label: 'On-Campus Non-AC Hostel + Mess', charge: 62000 },
    { id: 'ac', label: 'On-Campus AC Hostel + Mess', charge: 78000 }
  ],

  /* ------------------------------------------------------------------
     5. ABOUT US
     ------------------------------------------------------------------ */
  about: {
    legacyTitle: 'A Premier Hub for Technical & Professional Education',
    legacyText: 'Established in 2010 in Rooma, Kanpur, Axis Colleges of Higher Education was founded with a clear mission: to bridge the gap between classroom theory and modern industrial practice. Spread across a serene 65-acre eco-friendly campus on NH-2, our institutes nurture thousands of aspiring engineers, technologists, managers, and pharmacists every year.',
    approvalText: 'Our programs are duly approved by the All India Council for Technical Education (AICTE), New Delhi and the Pharmacy Council of India (PCI), with affiliations to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow and Chhatrapati Shahu Ji Maharaj University (CSJMU), Kanpur.',
    vision: 'To emerge as a nationally respected center of higher learning recognized for ethical leadership, research culture, and high employability.',
    mission: 'To deliver outcome-based education, hands-on laboratory training, and industry mentorship accessible to students from every background.',
    directorQuote: 'Education today is not merely earning a degree — it is developing problem-solving agility, character, and curiosity. At Axis Colleges, every laboratory session, project hackathon, and seminar is crafted to turn students into confident creators.',
    directorName: 'Prof. (Dr.) V. K. Srivastava',
    directorTitle: 'Director General, Axis Group of Colleges'
  },

  /* Constituent institutes table on the About page */
  colleges: [
    { name: 'Axis Institute of Technology & Management (AITM)', programs: 'B.Tech (CSE, AI & ML, ECE, ME), MBA', university: 'AKTU, Lucknow (Code: 719)', approval: 'AICTE, New Delhi', established: 2010 },
    { name: 'Axis Institute of Higher Education (AIHE)', programs: 'BCA, BBA, B.Sc (Biotech / Microbiology)', university: 'CSJMU, Kanpur', approval: 'UGC / State Govt.', established: 2014 },
    { name: 'Axis Business School (ABS)', programs: 'MBA (Dual Specialization), MCA', university: 'AKTU, Lucknow', approval: 'AICTE, New Delhi', established: 2012 },
    { name: 'Axis Institute of Pharmacy (AIP)', programs: 'B.Pharm, D.Pharm', university: 'AKTU & BTEUP, Lucknow', approval: 'PCI, New Delhi', established: 2018 }
  ],

  /* FAQ accordion items (About page) */
  faqs: [
    { id: 'f1', question: 'Is Axis Colleges approved by AICTE and affiliated to AKTU / CSJMU?', answer: 'Yes. Our Engineering, MBA, and MCA programs are approved by AICTE, New Delhi and affiliated to Dr. A.P.J. Abdul Kalam Technical University (AKTU), Lucknow. Undergraduate programs like BCA and BBA are affiliated to CSJM University (CSJMU), Kanpur.' },
    { id: 'f2', question: 'Are separate hostel and transport facilities available for students?', answer: 'Yes. Separate 24x7 secure on-campus hostels for boys and girls are available with hygienic mess, Wi-Fi, indoor games, and power backup. In addition, a fleet of 35+ college buses covers all major routes across Kanpur, Unnao, and nearby areas.' },
    { id: 'f3', question: 'Can students apply for UP Government Scholarship and Merit Waivers?', answer: 'Eligible students can apply for the UP Government Post-Matric Scholarship & Fee Reimbursement scheme. Additionally, Axis Colleges offers up to 25% institutional merit scholarship based on Class 12th / Graduation percentage.' },
    { id: 'f4', question: 'How does the Training & Placement Cell prepare students for IT & Core jobs?', answer: 'Students receive structured weekly classes in Coding (C, Java, Python, DSA, Web Dev), Quantitative Aptitude, Group Discussions, and Mock Technical Interviews starting from the second year, culminating in on-campus placement drives.' }
  ],

  /* ------------------------------------------------------------------
     6. HOME PAGE EXTRAS
     ------------------------------------------------------------------ */
  /* "Life at Axis" infrastructure cards */
  facilities: [
    { title: 'High-Tech Computing Centers', text: 'Over 600+ networked workstations equipped with modern IDEs, high-speed fiber internet, and dedicated AI & IoT innovation labs.', image: 'images/computer-lab.jpg' },
    { title: 'Digital & Central Library', text: 'More than 65,000+ textbooks, reference volumes, IEEE/DELNET e-journals, and peaceful air-conditioned reading halls.', image: 'images/library.jpg' },
    { title: 'Sports Arena & Separate Hostels', text: 'Expansive cricket and football grounds, indoor badminton courts, gymnasium, and secure on-campus boys & girls hostels.', image: 'images/sports-ground.jpg' }
  ],

  /* Recruiter names shown in the Training & Placement strip */
  recruiters: ['TCS', 'Infosys', 'Wipro', 'Cognizant', 'Capgemini', 'HCLTech', 'Tech Mahindra', 'HDFC Bank'],

  testimonials: [
    { id: 't1', quote: 'The coding clubs, regular hackathons, and supportive CSE faculty helped me crack two software engineering offers during my 7th semester.', name: 'Ananya Verma', role: 'B.Tech CSE • Placed at TCS Digital' },
    { id: 't2', quote: 'In BCA, every subject was backed by practical lab assignments in HTML, CSS, JavaScript, Java, and SQL. It gave me real confidence in building projects.', name: 'Rohan Mishra', role: 'BCA Batch • Placed at Infosys' },
    { id: 't3', quote: 'From industrial visits to guest lectures by corporate managers, the MBA program transformed my communication and presentation skills.', name: 'Priyanshi Shukla', role: 'MBA Finance • Placed at HDFC Bank' }
  ],

  /* ------------------------------------------------------------------
     7. CAMPUS GALLERY & EVENTS
     category must match one of the filter buttons (shown automatically)
     ------------------------------------------------------------------ */
  gallery: [
    { id: 'g1', title: 'Main Academic Block', caption: 'Architecture & Green Lawns', category: 'Sports & Campus', image: 'images/campus-hero.jpg' },
    { id: 'g2', title: 'Computer Science & Coding Lab', caption: '600+ Networked Workstations', category: 'Academics & Labs', image: 'images/computer-lab.jpg' },
    { id: 'g3', title: 'Central Digital Library', caption: '65,000+ Books & E-Journals', category: 'Academics & Labs', image: 'images/library.jpg' },
    { id: 'g4', title: 'Technovation Robotics Expo', caption: 'Annual Technical Festival', category: 'Fests & Placements', image: 'images/auditorium-fest.jpg' },
    { id: 'g5', title: 'Outdoor Sports Complex', caption: 'Cricket, Football & Athletics', category: 'Sports & Campus', image: 'images/sports-ground.jpg' },
    { id: 'g6', title: 'Placement Celebration Drive', caption: 'Corporate Resource Center', category: 'Fests & Placements', image: 'images/placement-drive.jpg' }
  ],

  /* dateText is shown to visitors; "open" = students can register online */
  events: [
    { id: 'e1', title: 'Technovation 2026 — 24-Hour Hackathon & Robotics', dateText: '15 – 16 November 2026', venue: 'Main Auditorium', description: 'Build innovative web apps, AI solutions, or line-follower robots. Open to all B.Tech, BCA, and MCA students with ₹50,000+ prize pool and participation certificates.', open: true },
    { id: 'e2', title: 'Workshop on Full-Stack Web & Cloud Deployment', dateText: '28 November 2026', venue: 'Seminar Hall A', description: 'One-day hands-on workshop led by industry engineers covering responsive HTML5, CSS3, JavaScript DOM projects, Git/GitHub, and cloud hosting.', open: true },
    { id: 'e3', title: "Resonance '26 — Annual Cultural & Literary Fest", dateText: '12 – 14 December 2026', venue: 'Open Air Amphitheatre', description: 'Three days of music bands, Nukkad Natak, debate championships, poetry slams, photography contests, and star evening performances.', open: true },
    { id: 'e4', title: 'Spardha — Inter-Departmental Sports Meet', dateText: '18 – 21 January 2027', venue: 'Sports Complex', description: 'Annual athletic championship featuring Cricket, Football, Volleyball, Badminton, Chess, Table Tennis, and 100m/400m Track Relays.', open: true }
  ],

  /* ------------------------------------------------------------------
     8. ADMISSIONS PAGE
     ------------------------------------------------------------------ */
  admissionSteps: [
    { title: 'Online Registration', text: 'Fill out the online admission inquiry form with accurate academic and contact details.' },
    { title: 'Counseling & Guidance', text: 'Connect with our academic counselors to choose the right specialization and check scholarship eligibility.' },
    { title: 'Document Verification', text: 'Submit 10th, 12th / Graduation marksheets, ID proof, and entrance scorecards (JEE / CUET if applicable).' },
    { title: 'Seat Confirmation', text: 'Complete initial registration fee payment and receive your official Admission Offer Letter & Roll ID.' }
  ],

  documents: [
    'Class 10th & 12th Marksheet and Passing Certificate',
    'Graduation Marksheets (for MCA / MBA applicants)',
    'Transfer Certificate (TC) & Character Certificate',
    'Aadhaar Card Copy & 4 Passport-Size Photographs',
    'Domicile & Income Certificate (for Scholarship)'
  ],

  /* Footer quick links */
  footerLinks: [
    { text: 'Home Page', href: 'index.html' },
    { text: 'About Institute', href: 'about.html' },
    { text: 'Courses & Fee Structure', href: 'courses.html' },
    { text: 'Photo Gallery & Events', href: 'campus.html' },
    { text: 'Online Admission Form', href: 'admissions.html' }
  ]
};
