export const ROLE_LABELS = {
  manager: 'Branch Manager',
  salesrep: 'Sales Representative',
  collector: 'Collector',
};

export const FAQ_CONTENT = {
  manager: [
    {
      question: 'How do I register a receiving batch?',
      answer:
        'Open the Manager dashboard, go to Receive Stock, add the batch details, attach any required photos, and finish the registration. The app will generate a QR code for tracking once the batch is saved.',
    },
    {
      question: 'What is the QR code used for?',
      answer:
        'The QR code acts as a quick tracking reference for a registered batch or stock event. It can be scanned later to confirm receiving, releases, or stock logs in the system.',
    },
    {
      question: 'What if I need to review previous stock entries?',
      answer:
        'Use the Stock Logs or the relevant manager stock pages to review earlier receiving and release records, including their QR details and timestamps.',
    },
    {
      question: 'Can I save or print the QR code?',
      answer:
        'Yes. After a QR code is generated, you can save it to your gallery or open the system print flow to print a copy for documentation or handoff.',
    },
    {
      question: 'How do I release stock to an agent or branch?',
      answer:
        'Open Release Stock, select the intended recipient, choose the release method, review the stock and delivery details, then confirm the release. Check the generated QR and release record before handing over the stock.',
    },
    {
      question: 'How do I handle a stock return?',
      answer:
        'Open the returns workflow, verify the returned items and their condition, scan or confirm the related stock reference, and submit the return details so the inventory record can be updated.',
    },
    {
      question: 'What should I do when stock quantities do not match?',
      answer:
        'Pause the confirmation, compare the physical count with the batch or release details, record the discrepancy with the required proof, and submit it through the appropriate alert or report workflow.',
    },
    {
      question: 'How do I check delivery progress?',
      answer:
        'Open Track Deliveries from the Manager dashboard to review assigned trips, checkpoints, current status, and the latest handoff or delivery updates.',
    },
  ],
  salesrep: [
    {
      question: 'How do I confirm a stock receipt?',
      answer:
        'From the Sales Rep dashboard, open the stock receiving flow and complete the confirmation steps. The app captures the QR and related proof details for the transaction.',
    },
    {
      question: 'What happens when a discrepancy is found?',
      answer:
        'You can report the issue from the alerts or discrepancy flow, attach the required proof, and continue with the resolution steps until the stock record is updated.',
    },
    {
      question: 'How do I view my logs?',
      answer:
        'Open your Logs section from the Sales Rep dashboard to review prior receiving, release, and discrepancy activity tied to your assigned branch inventory.',
    },
    {
      question: 'Can I scan a QR code to verify a shipment?',
      answer:
        'Yes. The QR scanner is designed for quick verification of stock and delivery activity during receiving or handover workflows.',
    },
    {
      question: 'How do I request additional stock?',
      answer:
        'Open the stock request flow, select the products and quantities needed, review the request, and submit it to the assigned branch manager for processing.',
    },
    {
      question: 'How do I submit a daily report?',
      answer:
        'Open Submit Report, enter the required activity and stock details, attach supporting proof when requested, review the information, and submit the report before the reporting deadline.',
    },
    {
      question: 'What should I do if a stock request is not appearing?',
      answer:
        'Refresh the request list and confirm that the correct branch and date are selected. If the request still does not appear, notify the manager and keep a record of the request details.',
    },
    {
      question: 'How do I record returned stock?',
      answer:
        'Open Return Stocks, select the related stock movement, verify the returned quantity and condition, attach required proof, and submit the return for review.',
    },
  ],
  collector: [
    {
      question: 'How do I confirm a delivery or handoff?',
      answer:
        'Open the collector delivery flow, scan the QR or confirm the delivery checkpoint, and complete the handoff process using the app-provided proof and location capture.',
    },
    {
      question: 'What if my device cannot read the QR?',
      answer:
        'Try to center the QR inside the camera frame, make sure there is enough light, and confirm that the code is not damaged or partially blurred before retrying.',
    },
    {
      question: 'Where do I see my delivery history?',
      answer:
        'Use the delivery and trip views in the Collector dashboard to review completed delivery checkpoints, accepted trips, and stock handoff records.',
    },
    {
      question: 'Do I need to upload photos during delivery?',
      answer:
        'Photos may be required during proof-of-delivery or checkpoint steps if the workflow requires additional verification for a stock handoff.',
    },
    {
      question: 'How do I accept a delivery assignment?',
      answer:
        'Open the available deliveries list, review the route and stock details, and accept the assignment only when you can complete the required checkpoints and handoff.',
    },
    {
      question: 'What should I do if I cannot complete a delivery?',
      answer:
        'Update the delivery status as soon as possible, record the reason and any required proof, and notify the assigned manager or branch contact through the approved process.',
    },
    {
      question: 'What happens at a delivery checkpoint?',
      answer:
        'Confirm the checkpoint location and delivery status, scan the relevant QR when requested, and submit the required photo, signature, or handoff details before continuing.',
    },
    {
      question: 'How do I review an assigned trip?',
      answer:
        'Open the trip or delivery detail screen to review the route, stock items, recipient information, checkpoints, and any proof already submitted for that assignment.',
    },
  ],
};

export const LEGAL_CONTENT = {
  manager: [
    {
      icon: 'lock',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock protects the personal and operational information collected for branch management, stock receiving, and reporting. This includes account details, branch identifiers, geotagging data, and photo proof when required for transactions.',
        'The app only uses this information to complete inventory, delivery, and compliance processes within the ChemStock workflow. Data is not used for unrelated marketing or commercial activity without further consent.',
        'Managers are responsible for safeguarding device access and ensuring that shared devices are secured with proper log-in controls and authentication practices.',
      ],
    },
    {
      icon: 'checkCircle',
      title: 'Terms of Use',
      paragraphs: [
        'Use of ChemStock is limited to authorized personnel for branch stock, receiving, release, and reporting operations. Unauthorized access, tampering, or sharing login credentials is prohibited.',
        'Users agree to enter accurate transaction details, maintain proof records when required, and use the app consistently with established branch procedures and operational policies.',
        'ChemStock reserves the right to restrict access or report misuse when system integrity, stock accuracy, or compliance obligations are affected.',
      ],
    },
    {
      icon: 'location',
      title: 'Location and delivery data',
      paragraphs: [
        'Location data is collected only when it supports stock receiving, release, delivery checkpoints, or handoff verification. It helps connect an operational event to the correct place and time.',
        'Users should keep location permissions enabled during workflows that require geotagged proof and should not submit another person\'s location or proof as their own.',
      ],
    },
  ],
  salesrep: [
    {
      icon: 'lock',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock processes location, stock, and proof-of-transaction data to support accurate receiving, release, and reporting workflows for Sales Representatives.',
        'This information is used strictly to complete branch transactions, maintain traceability, and support operational follow-up when discrepancies or returns are reported.',
        'Personal data in the app must be treated with confidentiality and only used for approved ChemStock business operations.',
      ],
    },
    {
      icon: 'checkCircle',
      title: 'Terms of Use',
      paragraphs: [
        'Sales Representatives must use the system only for valid stock transactions and approved branch operations. Any attempt to alter records, skip verification, or share access credentials is a violation of policy.',
        'The app records transaction proof for auditability and stock accountability. Users are expected to complete required validations before submitting or confirming any movement of stock.',
      ],
    },
    {
      icon: 'location',
      title: 'Location and transaction proof',
      paragraphs: [
        'Location and proof data support stock receipt, release, return, and discrepancy workflows and should only be captured for an active ChemStock operation.',
        'Users must review transaction details before submitting proof and report incorrect or suspicious records through the approved branch process.',
      ],
    },
  ],
  collector: [
    {
      icon: 'lock',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock collects location data, delivery checkpoints, and proof images as needed to confirm movement, handoff, and completion of delivery assignments for collectors.',
        'This information supports traceability, dispute resolution, and branch accountability and is not used outside the delivery and verification workflow without prior authorization.',
        'Collectors should keep assigned devices secure and avoid exposing transfer proofs or account access to unauthorized persons.',
      ],
    },
    {
      icon: 'checkCircle',
      title: 'Terms of Use',
      paragraphs: [
        'Collectors must complete assigned deliveries honestly and accurately, using the app for proof of handoff, checkpoint verification, and stock accountability.',
        'Failure to complete required checks, misreporting handoff status, or misuse of device access may result in restricted access or operational review.',
      ],
    },
    {
      icon: 'camera',
      title: 'Delivery proof and accountability',
      paragraphs: [
        'Photos, checkpoints, and handoff confirmations are operational records. They must show the relevant delivery condition or event and must not be altered to misrepresent completion.',
        'Only collect proof that is necessary for the assigned delivery and keep the device and account protected after the task is complete.',
      ],
    },
  ],
};
