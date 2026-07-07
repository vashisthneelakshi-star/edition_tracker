-- Default label values. The app falls back to these hardcoded defaults if a
-- row is missing, but seeding them means Admins see them ready-to-edit
-- immediately in the Admin Panel.

insert into ui_labels (key, value) values
('nav.content_planning', 'Content Planning'),
('content_planning.heading', 'Content Planning'),
('content_planning.subheading', 'Annual, monthly, weekly and daily content plans across every level of the organization.'),
('content_planning.new_button', '+ New Plan'),
('content_planning.ai_button', 'AI Analysis'),
('status.APPROVED', 'Approved'),
('status.SUBMITTED', 'Submitted'),
('status.IN_PROGRESS', 'In Progress'),
('status.DRAFTING', 'Drafting'),
('status.PENDING_REVIEW', 'Pending Review'),
('status.AWAITING_OPTIONS', 'Awaiting Options')
on conflict (key) do nothing;
