export function buildGreetingEmail(input: {
  ownerName: string;
  company: string | null;
  lastName: string | null;
  firstName: string | null;
}): { subject: string; text: string } {
  const { ownerName, company, lastName, firstName } = input;
  const subject = company
    ? `Greeting from First Page - ${company}`
    : "Greeting from First Page";
  const greeting = lastName ? `Dear ${lastName}` : firstName ? `Dear ${firstName}` : "Dear there";
  const text = `${greeting},

Thank you for getting in touch with First Page HK. We've received your enquiry form and I'd be happy to learn more about your business and explore how we can support your digital marketing goals.

As we offer a comprehensive range of digital marketing solutions, including SEO, SEM, Google Ads, Meta Ads and other performance-driven channels, I'd first like to understand your current priorities so that we can recommend the most suitable approach rather than taking a one-size-fits-all approach.

Could you share a little more about the following?
1) Preferred digital marketing channels: Are there any specific channels you are currently considering, such as SEO, Google Ads, Meta Ads, or others?
2) Objectives: What are you mainly looking to achieve e.g. increasing website traffic, generating leads, driving sales, improving brand visibility, or entering a new market?
3) Budget: Do you have an approximate monthly or campaign budget in mind?

If it's convenient, would you be available for a brief call this week? I'd be happy to learn more about the business, discuss your current digital marketing situation, and share some initial recommendations based on your objectives.

Best regards,
${ownerName}
First Page HK`.trim();
  return { subject, text };
}