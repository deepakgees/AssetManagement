// In-memory database for testing
let accounts = [
  {
    id: 1,
    name: 'Primary Trading Account',
    api_key: '***abc123',
    access_token: '***xyz789',
    description: 'Main trading account for equity investments',
    is_active: true,
    last_sync: '2024-01-15T10:30:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    user_id: 1
  },
  {
    id: 2,
    name: 'Secondary Account',
    api_key: '***def456',
    access_token: '***uvw012',
    description: 'Secondary account for options trading',
    is_active: true,
    last_sync: '2024-01-15T09:15:00Z',
    created_at: '2024-01-10T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    user_id: 1
  }
];

let nextId = 3;

const db = {
  query: async (sql, params = []) => {
    // Simple query parser for basic operations
    if (sql.includes('SELECT') && sql.includes('accounts')) {
      const userId = params[0] || 1;
      const userAccounts = accounts.filter(acc => acc.user_id === userId);
      return { rows: userAccounts };
    }
    
    if (sql.includes('INSERT') && sql.includes('accounts')) {
      const newAccount = {
        id: nextId++,
        name: params[1],
        api_key: params[2],
        access_token: params[3],
        is_active: params[4] || true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: params[0]
      };
      accounts.push(newAccount);
      return { rows: [newAccount] };
    }
    
    if (sql.includes('UPDATE') && sql.includes('accounts')) {
      const accountId = parseInt(params[params.length - 2]);
      const userId = parseInt(params[params.length - 1]);
      const accountIndex = accounts.findIndex(acc => acc.id === accountId && acc.user_id === userId);
      
      if (accountIndex !== -1) {
        const account = accounts[accountIndex];
        if (params[0]) account.name = params[0];
        if (params[1] !== undefined) account.is_active = params[1];
        account.updated_at = new Date().toISOString();
        return { rows: [account] };
      }
      return { rows: [] };
    }
    
    if (sql.includes('DELETE') && sql.includes('accounts')) {
      const accountId = parseInt(params[0]);
      const userId = parseInt(params[1]);
      const accountIndex = accounts.findIndex(acc => acc.id === accountId && acc.user_id === userId);
      
      if (accountIndex !== -1) {
        const deletedAccount = accounts.splice(accountIndex, 1)[0];
        return { rows: [deletedAccount] };
      }
      return { rows: [] };
    }
    
    return { rows: [] };
  }
};

module.exports = db; 