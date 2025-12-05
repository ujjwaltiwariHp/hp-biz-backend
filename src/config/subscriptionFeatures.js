const SUBSCRIPTION_FEATURES = [
    {
        key: 'lead_management',
        label: 'Lead Management',
        description: 'Create, view, and update leads status and details',
        category: 'Core'
    },
    {
        key: 'staff_management',
        label: 'Staff Management',
        description: 'Add and manage staff members and roles',
        category: 'Core'
    },

    {
        key: 'bulk_upload',
        label: 'Bulk Import',
        description: 'Upload leads via CSV/Excel files',
        category: 'Productivity'
    },
    {
        key: 'lead_transfer',
        label: 'Lead Transfer',
        description: 'Transfer leads ownership between staff members',
        category: 'Productivity'
    },

    {
        key: 'view_reports',
        label: 'Analytics & Reports',
        description: 'Access performance dashboards and conversion reports',
        category: 'Analytics'
    },
    {
        key: 'view_logs',
        label: 'Audit Logs',
        description: 'View detailed system activity and user logs',
        category: 'Security'
    },

    {
        key: 'email_notifications',
        label: 'Email Notifications',
        description: 'Receive system alerts via email',
        category: 'Communication'
    },
    {
        key: 'api_access',
        label: 'API Access',
        description: 'Access to Developer APIs and Webhooks',
        category: 'Developer'
    }
];

module.exports = { SUBSCRIPTION_FEATURES };