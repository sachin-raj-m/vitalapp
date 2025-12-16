export const getBloodRequestEmailHtml = ({
    donorName,
    bloodGroup,
    hospitalName,
    city,
    urgencyLevel,
    requestLink
}: {
    donorName: string;
    bloodGroup: string;
    hospitalName: string;
    city: string;
    urgencyLevel: string;
    requestLink: string;
}) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Urgent Blood Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fce7f3; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-height: 100vh;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #e11d48; padding: 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                                Vital<span style="opacity: 0.9; font-weight: 400;">App</span>
                            </h1>
                        </td>
                    </tr>

                    <!-- Hero Section -->
                    <tr>
                        <td style="padding: 40px 32px; text-align: center;">
                            <div style="background-color: #ffe4e6; display: inline-block; padding: 12px 24px; border-radius: 50px; margin-bottom: 24px;">
                                <span style="color: #e11d48; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Urgent Request</span>
                            </div>
                            <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 24px; font-weight: 700;">
                                ${bloodGroup} Blood Needed
                            </h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0;">
                                Hi <strong>${donorName}</strong>, a patient nearby urgently needs your help. You are a registered donor and a medical match.
                            </p>
                        </td>
                    </tr>

                    <!-- Details Card -->
                    <tr>
                        <td style="padding: 0 32px;">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Hospital</p>
                                                    <p style="margin: 4px 0 0 0; color: #1f2937; font-size: 16px; font-weight: 500;">${hospitalName}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 16px;">
                                                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Location</p>
                                                    <p style="margin: 4px 0 0 0; color: #1f2937; font-size: 16px; font-weight: 500;">${city}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Urgency Level</p>
                                                    <p style="margin: 4px 0 0 0; color: #e11d48; font-size: 16px; font-weight: 700;">${urgencyLevel}</p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding: 40px 32px; text-align: center;">
                            <a href="${requestLink}" style="background-color: #e11d48; color: #ffffff; display: inline-block; padding: 16px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(225, 29, 72, 0.25);">
                                View Request Details
                            </a>
                            <p style="margin-top: 24px; color: #9ca3af; font-size: 14px;">
                                <a href="${requestLink}" style="color: #6b7280; text-decoration: underline;">Open in App</a>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 20px;">
                                You received this email because you opted in to be a donor on VitalApp.<br>
                                Together, we save lives.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};
