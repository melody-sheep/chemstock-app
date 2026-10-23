export const ROLE_LABELS = {
  manager: 'Branch Manager',
  salesrep: 'Sales Representative',
  collector: 'Collector',
};

export const FAQ_CONTENT = {
  manager: [
    {
      category: 'Inventory',
      question: 'How do I register a receiving batch?',
      answer:
        'Open Receive Stock, enter the supplier and batch details, add the products and quantities, and attach any evidence requested by the workflow. Review the totals before saving. After registration, keep the generated QR with the physical batch so later scans can be matched to the correct record.',
    },
    {
      category: 'Inventory',
      question: 'What is the QR code used for?',
      answer:
        'A QR code links a physical batch or stock event to its ChemStock record. Scan the code only in the matching workflow, then verify the item, quantity, and transaction details shown in the app before confirming.',
    },
    {
      category: 'Records',
      question: 'What if I need to review previous stock entries?',
      answer:
        'Open Stock Logs or the relevant stock page and check the transaction type, product, quantity, recipient, status, and timestamp. If a record looks incorrect, compare it with the physical documents and raise it through your approved branch process instead of editing or recreating a transaction to hide the difference.',
    },
    {
      category: 'Inventory',
      question: 'Can I save or print the QR code?',
      answer:
        'When the QR screen offers those actions, save the image or use the print option. Check that the printed code is readable, attach it to the matching batch, and keep a digital copy only on an authorized device.',
    },
    {
      category: 'Transfers',
      question: 'How do I release stock to an agent or branch?',
      answer:
        'Open Release Stock, select the correct recipient and release method, add the items and quantities, then review the summary and delivery details. Confirm only after the physical stock matches the screen. Keep the release QR or receipt available for the recipient to verify and acknowledge.',
    },
    {
      category: 'Returns',
      question: 'How do I handle a stock return?',
      answer:
        'Open the returns workflow, identify the original stock movement, count the items received, and check their condition. Enter the actual return quantities and required evidence, review the return, then submit it for the required verification. Keep returned stock separate until your branch procedure says it can be restocked.',
    },
    {
      category: 'Records',
      question: 'What should I do when stock quantities do not match?',
      answer:
        'Pause before confirming the movement. Recount the physical items and compare them with the batch, release, or return record. Record the exact difference and attach clear evidence if requested, then submit the discrepancy through the appropriate workflow and follow up with the assigned person.',
    },
    {
      category: 'Delivery',
      question: 'How do I check delivery progress?',
      answer:
        'Open Track Deliveries to review each trip’s assignment, checkpoints, current status, and latest handoff updates. Open a delivery for its details when something needs attention; use the recorded status and timestamp when coordinating follow-up.',
    },
    {
      category: 'Transfers',
      question: 'When is a direct release considered received?',
      answer:
        'A release and a receipt are separate events. Check the transaction status and acceptance record before treating stock as available to the recipient. If acceptance is still pending, contact the recipient and do not record a second release to compensate.',
    },
    {
      category: 'Accounts',
      question: 'How should I manage team accounts?',
      answer:
        'Create or update accounts only for authorized team members and use the correct role and branch assignment. Never share passwords. Ask the user to secure their own login, and remove or disable access through the approved account process when it is no longer needed.',
    },
  ],
  salesrep: [
    {
      category: 'Receiving',
      question: 'How do I confirm a stock receipt?',
      answer:
        'Open the receiving flow from your dashboard, scan or select the matching release, then compare every item and quantity with the stock physically handed to you. Add the requested proof and confirm only when the details are accurate. Report a shortage, excess, damage, or wrong item through the issue workflow instead of accepting an incorrect count.',
    },
    {
      category: 'Issues',
      question: 'What happens when a discrepancy is found?',
      answer:
        'Open the relevant alert or discrepancy workflow, select the reason, describe what you observed, and attach clear evidence when requested. Submit the report and follow its status. Keep the stock and supporting documents available until the manager confirms the next step.',
    },
    {
      category: 'Records',
      question: 'How do I view my logs?',
      answer:
        'Open Logs from your dashboard to review receiving, releases, returns, and discrepancy activity available to your account. Check the status, quantities, and timestamp when reconciling a movement. A pending record may still need another person’s verification before inventory is updated.',
    },
    {
      category: 'Receiving',
      question: 'Can I scan a QR code to verify a shipment?',
      answer:
        'Yes. Use the scanner in the receiving or handoff workflow that matches the shipment. Make sure the full code is visible and well lit, then confirm that the displayed product, sender, and transaction match the physical delivery before continuing.',
    },
    {
      category: 'Requests',
      question: 'How do I request additional stock?',
      answer:
        'Open Stock Request, choose the products and quantities needed, and review the request before sending it to your assigned manager. Use the notes field to explain urgency or context. Track the request status and avoid submitting duplicates while an equivalent request is still pending.',
    },
    {
      category: 'Reports',
      question: 'How do I submit a daily report?',
      answer:
        'Open Submit Report, complete the required activity and stock fields, and attach supporting proof when the form requests it. Check dates, quantities, and notes before submitting. If you discover an error afterward, tell your manager and follow the correction process rather than submitting a conflicting report.',
    },
    {
      category: 'Requests',
      question: 'What should I do if a stock request is not appearing?',
      answer:
        'Refresh the request list and check that you are signed into the correct account and viewing the relevant status or date. If it is still missing, share the product, quantity, and approximate submission time with your manager. Do not assume the request was approved until its status confirms it.',
    },
    {
      category: 'Returns',
      question: 'How do I record returned stock?',
      answer:
        'Open Return Stocks and select the related movement. Count the items, inspect their condition, enter the actual quantities, and attach evidence requested by the flow. Review and submit the return for verification; keep the items separate until you receive instructions about restocking.',
    },
    {
      category: 'Receiving',
      question: 'What if the received items or quantities are wrong?',
      answer:
        'Do not confirm a receipt that does not match the physical delivery. Recount the items, capture the requested proof, and report the specific mismatch in the issue or discrepancy workflow. Contact your manager promptly and wait for guidance on how to handle the stock.',
    },
    {
      category: 'Account',
      question: 'Who should I contact for access or profile problems?',
      answer:
        'Use the manager contact information shown in your profile when available. Never send your password or verification codes. If your account details or assigned branch are incorrect, ask the manager to correct them through the authorized account process.',
    },
  ],
  collector: [
    {
      category: 'Deliveries',
      question: 'How do I confirm a delivery or handoff?',
      answer:
        'Open the assigned delivery or trip, verify the recipient and stock details, and follow each checkpoint in order. Scan the relevant QR and submit the requested location, photo, or handoff confirmation. Confirm completion only after the stock is physically handed to the correct recipient.',
    },
    {
      category: 'QR & checkpoints',
      question: 'What if my device cannot read the QR?',
      answer:
        'Clean the camera lens, improve the lighting, and hold the full QR steady inside the frame. Check that the label is not torn or covered and retry from the correct delivery workflow. If it remains unreadable, do not guess or use another shipment’s code; contact the assigned manager for the approved next step.',
    },
    {
      category: 'Records',
      question: 'Where do I see my delivery history?',
      answer:
        'Use the delivery and trip views on your dashboard to review accepted assignments, checkpoint progress, and completed handoffs. Open a trip to check its route, timestamps, status, and proof. Tell your manager if a record appears incomplete or does not match what happened.',
    },
    {
      category: 'Proof',
      question: 'Do I need to upload photos during delivery?',
      answer:
        'Follow the proof requirements shown in the assigned delivery. When a photo is requested, capture the relevant handoff or condition clearly and avoid including unrelated people or private information. Do not upload an old or altered image as proof of a current delivery.',
    },
    {
      category: 'Deliveries',
      question: 'How do I accept a delivery assignment?',
      answer:
        'Open available deliveries, review the destination, route, stock details, and required checkpoints, and accept only if you can complete the assignment. If you cannot take it or see a problem, leave it unaccepted and notify the manager rather than accepting and abandoning the trip.',
    },
    {
      category: 'Exceptions',
      question: 'What should I do if I cannot complete a delivery?',
      answer:
        'Update the delivery status as soon as the workflow allows, record the reason accurately, and provide the requested evidence. Contact the assigned manager promptly for instructions about the stock and route. Do not mark a delivery complete if the handoff did not happen.',
    },
    {
      category: 'QR & checkpoints',
      question: 'What happens at a delivery checkpoint?',
      answer:
        'At each checkpoint, confirm that you are at the expected stop and follow the on-screen instructions. Scan the requested QR and submit the required status or proof before continuing. If the location or details do not match, pause and contact the manager rather than submitting inaccurate information.',
    },
    {
      category: 'Deliveries',
      question: 'How do I review an assigned trip?',
      answer:
        'Open the trip or delivery details to review the route, stock items, recipient, checkpoints, status, and proof already submitted. Review these details before departure and again if the assignment changes. Report a wrong recipient or unexpected stock immediately.',
    },
    {
      category: 'Exceptions',
      question: 'What if the recipient is unavailable or refuses the stock?',
      answer:
        'Do not leave stock unattended or mark the handoff as complete. Record the outcome using the available status, capture only the proof requested by the workflow, and contact the assigned manager for instructions about safekeeping or return.',
    },
    {
      category: 'Account',
      question: 'How should I protect delivery and location information?',
      answer:
        'Use location and camera permissions only for the active delivery workflow, keep your device locked when not in use, and do not share account access or delivery proof in public channels. Report a lost device or exposed account to your manager promptly.',
    },
  ],
};

export const LEGAL_CONTENT = {
  manager: [
    {
      icon: 'lock',
      summary: 'How ChemStock handles personal information used during branch operations.',
      reference: 'Republic Act No. 10173 — Data Privacy Act of 2012',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock may process account and contact details, branch and transaction records, and location or photo evidence when a workflow requires it. These details help identify authorized users, document stock movements, and investigate reported issues.',
        'The Data Privacy Act of 2012 provides the Philippine framework for protecting personal information. Access and use of information in ChemStock should be limited to authorized operational purposes and handled according to the organization’s privacy notices, retention rules, and procedures.',
        'Managers should restrict access to approved personnel, avoid exporting or sharing personal data unnecessarily, and promptly report suspected exposure through the organization’s designated privacy or security contact.',
      ],
      practices: [
        'Use only your own account and never share passwords or one-time codes.',
        'Review recipient and branch access when team assignments change.',
        'Keep transaction evidence within approved systems and channels.',
      ],
    },
    {
      icon: 'checkCircle',
      summary: 'Use the system only for authorized, accurate, and traceable stock operations.',
      reference: 'Organization policies and authorized ChemStock workflows',
      title: 'Terms of Use',
      paragraphs: [
        'Use ChemStock only for assigned business tasks and follow the workflow shown for each receiving, release, return, delivery, and reporting activity. Do not bypass verification, impersonate another user, alter evidence, or create duplicate records to conceal a discrepancy.',
        'Check item, quantity, recipient, and status details before submitting. A submitted event is an operational record; if it is incorrect, report it through the approved correction or discrepancy process so the history remains understandable.',
        'Your organization’s approved procedures take precedence where they require additional controls. Access may be reviewed when account use or transaction activity appears inconsistent with those procedures.',
      ],
      practices: [
        'Confirm physical counts before saving or accepting a stock movement.',
        'Keep pending receipts and handoffs distinct from completed transactions.',
        'Escalate an incorrect or suspicious record; do not silently recreate it.',
      ],
    },
    {
      icon: 'location',
      summary: 'Location is used to support operational events when the workflow requests it.',
      reference: 'ChemStock location and evidence workflows',
      title: 'Location and delivery data',
      paragraphs: [
        'Location information may be attached to receiving, release, delivery checkpoint, or handoff events to help establish where and when an operational action was recorded. Camera or location permissions may be needed only for a workflow that requests those capabilities.',
        'Do not submit another person’s location or evidence as your own. If a location appears incorrect or permission is unavailable, pause and follow the approved exception process rather than entering misleading information.',
      ],
      practices: [
        'Allow location access while completing a workflow that explicitly needs it.',
        'Capture evidence that is relevant to the transaction and no more than needed.',
      ],
    },
  ],
  salesrep: [
    {
      icon: 'lock',
      summary: 'Personal information and transaction evidence must be handled for approved work purposes.',
      reference: 'Republic Act No. 10173 — Data Privacy Act of 2012',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock may process account details, branch and stock records, and location or photo evidence requested during receiving, release, return, or reporting workflows. This information supports transaction traceability and follow-up when a record needs review.',
        'The Data Privacy Act of 2012 provides the Philippine framework for protecting personal information. Use personal data only for authorized ChemStock work, follow your organization’s privacy and retention procedures, and do not share contact details or evidence with people who do not need them for the task.',
        'Report a lost device, exposed account, or unintended disclosure promptly through the designated manager or privacy contact.',
      ],
      practices: [
        'Use your own account and keep passwords and verification codes private.',
        'Do not include unrelated people or personal details in transaction photos.',
        'Keep reports and evidence in approved business channels.',
      ],
    },
    {
      icon: 'checkCircle',
      summary: 'Verify what physically happened and keep the transaction history accurate.',
      reference: 'Organization policies and authorized ChemStock workflows',
      title: 'Terms of Use',
      paragraphs: [
        'Use the app only for assigned branch operations. Follow the receiving, request, return, and discrepancy steps provided in the workflow, and do not confirm a quantity until it matches the physical stock.',
        'Transaction proof helps the organization review stock activity. Enter accurate information, attach evidence only when requested, and report mistakes through the approved correction process. Do not modify proof to make an incomplete or incorrect event appear complete.',
        'Follow any stricter branch procedures for stock custody, reporting deadlines, and approvals.',
      ],
      practices: [
        'Check the item, quantity, sender, and status before confirming a receipt.',
        'Treat a pending request or receipt as pending until its status changes.',
        'Report shortages, damage, or wrong items promptly with clear details.',
      ],
    },
    {
      icon: 'location',
      summary: 'Capture proof only for an active operation and review it before submission.',
      reference: 'ChemStock location and evidence workflows',
      title: 'Location and transaction proof',
      paragraphs: [
        'Location or photo proof may be requested to document a stock receipt, release, return, or discrepancy. Use the camera and location features for the active transaction only and ensure the proof accurately represents what happened.',
        'If the app cannot capture the required proof or the displayed location is wrong, notify your manager and use the approved exception process. Do not attach unrelated or previously captured evidence.',
      ],
      practices: [
        'Review the image and transaction details before submitting.',
        'Avoid sharing evidence outside approved business channels.',
      ],
    },
  ],
  collector: [
    {
      icon: 'lock',
      summary: 'Delivery records may include contact details, route information, and proof of handoff.',
      reference: 'Republic Act No. 10173 — Data Privacy Act of 2012',
      title: 'Data Privacy Notice (RA 10173)',
      paragraphs: [
        'ChemStock may process your account details, recipient or branch information, delivery checkpoints, and photo evidence when requested to document an assigned delivery. These details help establish the status of stock and support follow-up when a handoff is disputed.',
        'The Data Privacy Act of 2012 provides the Philippine framework for protecting personal information. Use delivery information only for the assigned operation and follow your organization’s privacy, retention, and incident-reporting procedures.',
        'Keep your device and account secure. If the device is lost or delivery information is exposed, tell the assigned manager or designated privacy contact promptly.',
      ],
      practices: [
        'Do not share account access, recipient details, or delivery photos publicly.',
        'Capture only the evidence requested for the current delivery.',
        'Use contact details only to coordinate the assigned handoff.',
      ],
    },
    {
      icon: 'checkCircle',
      summary: 'Complete the assigned route honestly and record handoffs as they occur.',
      reference: 'Organization policies and authorized ChemStock workflows',
      title: 'Terms of Use',
      paragraphs: [
        'Use ChemStock only for deliveries assigned to your account. Check the route, recipient, and stock details, follow the required checkpoints, and enter each status truthfully.',
        'Do not mark a delivery complete before the stock has been handed to the correct recipient. If a stop cannot be completed, record the actual outcome and contact the manager for instructions about the stock and next steps.',
        'Follow branch procedures for stock custody, route changes, unsuccessful deliveries, and returns.',
      ],
      practices: [
        'Verify the recipient and stock before handing items over.',
        'Never leave stock unattended unless an approved procedure explicitly allows it.',
        'Report an unavailable recipient, damaged item, or route issue promptly.',
      ],
    },
    {
      icon: 'camera',
      summary: 'Photos, checkpoints, and handoff confirmations are operational records.',
      reference: 'ChemStock delivery proof and accountability workflows',
      title: 'Delivery proof and accountability',
      paragraphs: [
        'When the workflow requests a photo, capture the relevant stock condition or handoff clearly. Check that the image is current and appropriate before submitting; do not alter or reuse evidence to misrepresent a checkpoint or completed delivery.',
        'Location and camera access should support the active delivery step. If a permission or capture problem prevents completion, record the issue and contact the manager rather than submitting inaccurate proof.',
      ],
      practices: [
        'Avoid capturing unrelated people or private information.',
        'Do not claim a handoff or checkpoint that did not occur.',
        'Keep the device locked when it is not being used for the delivery.',
      ],
    },
  ],
};
