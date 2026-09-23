export const supportContacts = {
  // TODO: Replace with official SLAB support phone before production.
  phone: "",
  // TODO: Replace with official SLAB support email before production.
  email: "",
};

export const supportQuestions = [
  {
    question: "How do I book equipment?",
    answer: [
      "1. Choose your equipment.",
      "2. Select or create a project.",
      "3. Choose the site location.",
      "4. Select start date & time.",
      "5. Enter quantity and estimated duration.",
      "6. Add operator, requirements, or photos if needed.",
      "7. Check the estimate.",
      "8. Review and confirm the booking.",
      "9. Complete the SLAB booking/payment step.",
      "10. Receive your Job PIN and tracking information.",
    ],
  },
  {
    question: "How does tracking work?",
    answer: ["After the provider accepts your booking, SLAB shows the provider, route, distance and estimated arrival time. You can follow the provider until they reach your site."],
  },
  {
    question: "What equipment can I book?",
    answer: ["SLAB supports:", "Excavators", "JCB / Backhoe", "Cranes", "Tippers", "Septic Tank Services", "Waste Management Services"],
  },
  {
    question: "Can I create a project?",
    answer: ["Yes. Create a project with your project name, site location, contact details and requirements. You can link bookings to your project and track project activity."],
  },
  {
    question: "How does payment work?",
    answer: [
      "SLAB handles the applicable booking/platform payment. The actual equipment/service amount is settled directly between the customer and provider.",
      "Emergency bookings have:",
      "SLAB Booking Fee = ₹0.",
    ],
  },
  {
    question: "What is Emergency Booking?",
    answer: ["Emergency Booking helps customers request an urgently needed service from an available nearby provider. Add the site location and service details, then SLAB starts the emergency matching flow."],
  },
  {
    question: "How do I contact support?",
    answer: ["Open Contact & Support to find SLAB support contact details and available help options."],
  },
];

export const supportSections = [
  ["Booking Support", "Help with equipment selection, booking steps, estimates, confirmation, Job PINs, and tracking."],
  ["Equipment & Provider Support", "Help with provider matching, equipment availability, operator needs, and service requirements."],
  ["Payment Support", "Help with SLAB booking/platform payment, receipts, payment status, and failed payment attempts."],
  ["Emergency Support", "Help with urgent service requests, nearest-provider matching, ETA, and emergency booking status."],
  ["Project Support", "Help creating projects, linking bookings, updating site details, and keeping project activity organized."],
] as const;
