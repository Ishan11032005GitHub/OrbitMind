export type EmailCategory = "Work" | "Finance" | "Calendar" | "Security" | "Notification" | "Personal";
export type EmailPriority = "High" | "Medium" | "Low";

export function classifyEmail(subject: string, snippet: string) {
  const text = `${subject} ${snippet}`.toLowerCase();
  const category: EmailCategory = /password|security|login|verification|otp|suspicious|two-factor/.test(text)
    ? "Security"
    : /invoice|payment|receipt|refund|bank|statement|credited|salary|stipend|reimbursement/.test(text)
      ? "Finance"
      : /calendar|meeting|invite|appointment|schedule|reschedul|agenda/.test(text)
        ? "Calendar"
        : /unsubscribe|newsletter|notification|alert|digest|automated/.test(text)
          ? "Notification"
          : /project|client|review|deadline|proposal|contract|sprint|roadmap|work/.test(text)
            ? "Work"
            : "Personal";
  const priority: EmailPriority = /urgent|action required|asap|immediately|deadline|final warning|security|suspicious|otp/.test(text)
    ? "High"
    : /newsletter|unsubscribe|digest|promotion|offer|automated/.test(text)
      ? "Low"
      : "Medium";
  return { category, priority };
}
