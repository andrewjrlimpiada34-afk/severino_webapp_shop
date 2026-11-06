const termsSections = [
  {
    number: '1',
    title: 'General Acceptance and Legal Framework',
    body:
      'This agreement binds every user who signs in, creates an account, browses the catalog, places an order, or uses any Severino platform service.',
    items: [
      ['Account use', 'Users must provide accurate details and keep login credentials secure.'],
      ['Platform access', 'Continued access depends on compliance with these terms and local laws.'],
    ],
  },
  {
    number: '2',
    title: 'Privacy Law and Regulatory Data Compliance',
    body:
      'Personal information, order records, location-based forecasts, and system activity are handled only for account, delivery, security, and service improvement purposes.',
    items: [
      ['Data minimization', 'Only information needed to operate the service is collected.'],
      ['User rights', 'Users may request account updates, corrections, or deletion when allowed by law.'],
      ['Security logs', 'Technical records may be used to detect abuse and protect customer accounts.'],
    ],
  },
  {
    number: '3',
    title: 'E-Commerce and Transactional Provisions',
    body:
      'Orders, reservations, delivery details, and COD confirmations are processed as valid electronic records for the selected Severino products.',
    items: [
      ['Order records', 'Cart, checkout, and order status updates are maintained for fulfillment.'],
      ['Transparent totals', 'Product price, quantity, and customer-provided delivery details determine the final order record.'],
    ],
  },
  {
    number: '4',
    title: 'System Automation, Resource Abuse, and Metrics',
    body:
      'The platform may automate recommendations, notifications, reports, and operational checks to keep the shopping experience stable.',
    items: [
      ['Acceptable use', 'Users must not disrupt, overload, scrape, or reverse engineer platform systems.'],
      ['Operational metrics', 'Performance and error signals may be reviewed to improve reliability.'],
    ],
  },
  {
    number: '5',
    title: 'Limitation of Liability and Indemnification',
    body:
      'Services are provided as available. Severino is not liable for interruptions, incorrect user-provided details, third-party failures, or delays outside reasonable control.',
    items: [
      ['Customer responsibility', 'Users are responsible for truthful information and lawful platform use.'],
      ['Service limits', 'Remedies are limited to actions permitted by applicable consumer protection laws.'],
    ],
  },
]

export const policies = {
  terms: {
    label: 'Terms of Service',
    title: 'Terms of Service',
    summary: 'Please read our terms and privacy information before signing in or placing an order.',
    sections: termsSections,
    footer: 'By using this platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service and Privacy Agreement.',
  },
  privacy: {
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    summary: 'How Severino uses the information you provide while shopping with us.',
    sections: [
      {
        number: '1', title: 'Information you provide',
        body: 'We use your name, email, mobile number, delivery address, account details, and order information to manage your account, verify your email, and fulfill your purchases.',
        items: [['Shopping activity', 'Saved favorites, checkout selections, and order records support the features you choose to use.'], ['Feedback and reviews', 'Information you submit in feedback, reviews, or attachments is processed to display your review or respond to your request.']],
      },
      {
        number: '2', title: 'Optional services',
        body: 'Google sign-in, weather recommendations, and third-party media involve the providers of those services when you choose to use them.',
        items: [['Google sign-in', 'Google supplies profile and email information when you choose to sign in with Google.'], ['Weather recommendations', 'When you enable Adaptive Scent and grant location access, your coordinates are sent to Open-Meteo to retrieve a forecast. You can choose the default Marinduque forecast instead.'], ['Facebook and videos', 'Opening the live Facebook feed or embedded videos connects your browser to the relevant provider, which may process information under its own privacy policy.']],
      },
      {
        number: '3', title: 'Browser storage and account records',
        body: 'Cookies and browser storage support sign-in, preferences, and shopping features. The Cookie Policy explains their purposes and lifetimes.',
        items: [['Your device', 'You can clear cookies and stored site data in your browser. This may sign you out or remove locally saved preferences and favorites.'], ['Account records', 'Clearing browser data does not delete server-side account, order, review, or feedback records.']],
      },
      {
        number: '4', title: 'Your choices and requests',
        body: 'You can update account details from your account page, sign out, decline location access, or leave optional third-party content unopened.',
        items: [['Contact us', 'For questions or requests about access, correction, or deletion of your personal information, contact uvervidallonguevara@gmail.com. Requests are handled subject to applicable law and any records that must be retained for transactions or security.']],
      },
    ],
    footer: 'For information about your privacy rights in the Philippines, visit the National Privacy Commission at privacy.gov.ph.',
  },
  cookies: {
    label: 'Cookie Policy',
    title: 'Cookie Policy',
    summary: 'What Severino stores in your browser, why it is used, and how you can manage it.',
    sections: [
      {
        number: '1', title: 'Cookies and similar storage',
        body: 'Cookies are small pieces of data your browser sends back to a website. Severino also uses local storage and session storage, which keep information in your browser for shopping features and preferences.',
        items: [['Local storage', 'Information can remain between visits until you clear it, the app removes it, or your browser removes site data.'], ['Session storage', 'Information normally lasts for the current tab session. Your browser may restore it when restoring tabs.']],
      },
      {
        number: '2', title: 'Essential sign-in cookies',
        body: 'These cookies allow the service to recognize your signed-in account and protect the Google sign-in process.',
        items: [['token', 'A session cookie used to authenticate requests. The sign-in token is valid for up to two hours and the cookie is cleared when you sign out. Browser session restoration may preserve a session cookie.'], ['oauth_state', 'A security cookie used when you start Google sign-in. It expires after ten minutes and is cleared when the sign-in callback is processed.']],
      },
      {
        number: '3', title: 'Shopping preferences on this device',
        body: 'Local storage remembers your font, theme, grid or list view, saved favorites, notification read or hidden states, and checkout selections. A cached profile is stored while signed in and removed at sign-out.',
        items: [['Local preferences', 'These remain until you clear site data, change the setting, or the app removes the relevant entry. Checkout selections are removed as purchases are completed.'], ['Tab preferences', 'Session storage remembers Adaptive Scent settings, the floating panel position, sign-in navigation, administrator session status, and whether a welcome offer has been shown during the tab session.']],
      },
      {
        number: '4', title: 'Optional third-party content',
        body: 'The live Facebook feed loads only when you choose Show live Facebook feed. Google sign-in and embedded videos also connect to external providers when used. Those providers may use their own cookies and storage.',
        items: [['Your choice', 'You can use the catalog without opening the live feed or signing in with Google. Closing an embed stops displaying it but does not clear cookies already set by its provider.'], ['Provider controls', 'Use your browser’s site-data and third-party-cookie settings to manage data stored by external services.']],
      },
      {
        number: '5', title: 'Managing cookies and stored data',
        body: 'You can block or delete cookies and clear local or session storage through your browser’s privacy or site-data settings. Blocking essential cookies may prevent sign-in and account features from working.',
        items: [['What clearing data changes', 'It may sign you out and remove preferences, favorites, or checkout selections saved on this device. It does not delete account or order records held by Severino.'], ['Questions', 'Contact uvervidallonguevara@gmail.com for questions about this policy. We update this notice when browser storage practices change.']],
      },
    ],
    footer: 'This notice explains browser storage. Opening a policy does not accept the sign-in agreement or change your browser settings.',
  },
}

export const policyUpdated = 'November 6, 2026'
