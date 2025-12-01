
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { getAccounts, createAccount, updateAccount, deleteAccount, syncAccount, syncAllAccounts, getLoginUrl, exchangeToken, type Account, type CreateAccountData, type UpdateAccountData } from '../services/accountsService';

interface Message {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface AccountFormData {
  name: string;
  family: string;
  apiKey: string;
  apiSecret: string;
  requestToken: string;
  description: string;
}

export default function Accounts() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    family: '',
    apiKey: '',
    apiSecret: '',
    requestToken: '',
    description: '',
  });

  const queryClient = useQueryClient();

  // Message management functions
  const addMessage = (type: 'success' | 'error' | 'info', message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    
    // Auto-remove success and info messages after 5 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, 5000);
    }
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  // Real API calls
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    refetchInterval: 30000,
  });

  const addAccountMutation = useMutation({
    mutationFn: (newAccount: CreateAccountData) => createAccount(newAccount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
      addMessage('success', 'Account created successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to create account: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateAccountData) => updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      handleCloseDialog();
      addMessage('success', 'Account updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update account: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      addMessage('success', 'Account deleted successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to delete account: ${error.response?.data?.message || error.message}`);
    },
  });

  const syncAccountMutation = useMutation({
    mutationFn: ({ id, accessToken }: { id: number; accessToken?: string }) => syncAccount(id, accessToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      addMessage('success', 'Account sync completed successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Sync failed: ${error.response?.data?.message || error.message}`);
    },
  });

  const getLoginUrlMutation = useMutation({
    mutationFn: getLoginUrl,
    onSuccess: (data) => {
      window.open(data.loginUrl, '_blank');
      addMessage('info', 'Login URL opened in new tab. Please complete the authentication flow.');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to get login URL: ${error.response?.data?.message || error.message}`);
    },
  });

  const exchangeTokenMutation = useMutation({
    mutationFn: ({ id, requestToken }: { id: number; requestToken: string }) => 
      exchangeToken(id, requestToken),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      addMessage('success', `Authentication successful! Welcome ${data.userProfile.user_name}`);
    },
    onError: (error: any) => {
      addMessage('error', `Authentication failed: ${error.response?.data?.message || error.message}`);
    },
  });

  const syncAllAccountsMutation = useMutation({
    mutationFn: syncAllAccounts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      addMessage('success', 'All accounts synced successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Sync all failed: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        family: account.family || '',
        apiKey: account.apiKey || '',
        apiSecret: account.apiSecret || '',
        requestToken: account.requestToken || '',
        description: account.description || '',
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        family: '',
        apiKey: '',
        apiSecret: '',
        requestToken: '',
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingAccount(null);
    setFormData({
      name: '',
      family: '',
      apiKey: '',
      apiSecret: '',
      requestToken: '',
      description: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      addMessage('error', 'Please fill in the account name');
      return;
    }

    if (editingAccount) {
      updateAccountMutation.mutate({
        id: editingAccount.id,
        name: formData.name,
        family: formData.family,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        requestToken: formData.requestToken,
        description: formData.description,
      });
    } else {
      addAccountMutation.mutate({
        name: formData.name,
        family: formData.family,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        requestToken: formData.requestToken,
        description: formData.description,
      });
    }
  };

  const handleDelete = (accountId: number) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      deleteAccountMutation.mutate(accountId);
    }
  };

  const handleSyncAll = () => {
    if (window.confirm('Are you sure you want to sync all accounts? This may take a few minutes.')) {
      syncAllAccountsMutation.mutate();
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const maskApiKey = (key: string) => {
    if (showApiKeys) return key;
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };

  // Group accounts by family
  const groupAccountsByFamily = () => {
    if (!accounts) return new Map<string, Account[]>();
    
    const grouped = new Map<string, Account[]>();
    accounts.forEach((account) => {
      const family = account.family || 'Ungrouped';
      if (!grouped.has(family)) {
        grouped.set(family, []);
      }
      grouped.get(family)!.push(account);
    });
    
    return grouped;
  };

  const toggleFamily = (family: string) => {
    setExpandedFamilies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(family)) {
        newSet.delete(family);
      } else {
        newSet.add(family);
      }
      return newSet;
    });
  };

  const groupedAccounts = groupAccountsByFamily();

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Account Management</h1>
        <div className="flex gap-3">
          <button
            onClick={() => handleSyncAll()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Sync All
          </button>
          <button
            onClick={() => handleOpenDialog()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Account
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Zerodha Accounts ({accounts?.length || 0})
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Use the ↗️ button for manual login URL
            </p>
          </div>
          <button
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            {showApiKeys ? (
              <>
                <EyeSlashIcon className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <EyeIcon className="h-4 w-4 mr-1" />
                Show
              </>
            )}{' '}
            API Keys
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from(groupedAccounts.entries()).map(([family, familyAccounts]) => {
                const isExpanded = expandedFamilies.has(family);
                return (
                  <Fragment key={family}>
                    {/* Family Header Row */}
                    <tr 
                      className="bg-gray-100 hover:bg-gray-200 cursor-pointer"
                      onClick={() => toggleFamily(family)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap" colSpan={3}>
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDownIcon className="h-5 w-5 text-gray-600 mr-2" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5 text-gray-600 mr-2" />
                          )}
                          <span className="text-sm font-semibold text-gray-900">
                            {family} ({familyAccounts.length} {familyAccounts.length === 1 ? 'account' : 'accounts'})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Account Rows (shown when expanded) */}
                    {isExpanded && familyAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap pl-12">
                          <div className="text-sm font-medium text-gray-900">{account.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {account.lastSync ? (
                            <div>
                              <div>{formatDate(account.lastSync)}</div>
                              <div className="text-xs text-green-600">✓ Synced</div>
                            </div>
                          ) : (
                            <div>
                              <div>Never</div>
                              <div className="text-xs text-gray-500">Not synced</div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(account);
                            }}
                            className="text-primary-600 hover:text-primary-900 mr-3"
                            title="Edit Account"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              getLoginUrlMutation.mutate(account.id);
                            }}
                            disabled={getLoginUrlMutation.isPending}
                            className={`mr-3 ${getLoginUrlMutation.isPending ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-900'}`}
                            title="Get Login URL"
                          >
                            <ArrowTopRightOnSquareIcon className={`h-4 w-4 ${getLoginUrlMutation.isPending ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              syncAccountMutation.mutate({ id: account.id });
                            }}
                            disabled={syncAccountMutation.isPending}
                            className={`mr-3 ${syncAccountMutation.isPending ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:text-green-900'}`}
                            title="Sync Holdings & Positions"
                          >
                            <ArrowPathIcon className={`h-4 w-4 ${syncAccountMutation.isPending ? 'animate-spin' : ''}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Account Dialog */}
      <Transition.Root show={openDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseDialog}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      {editingAccount ? 'Edit Account' : 'Add New Account'}
                    </Dialog.Title>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Account Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Family
                        </label>
                        <input
                          type="text"
                          value={formData.family}
                          onChange={(e) => setFormData({ ...formData, family: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="e.g., Saran Family, Rajat Family"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        />
                      </div>
                                             <div>
                         <label className="block text-sm font-medium text-gray-700">
                           API Key *
                         </label>
                         <input
                           type="password"
                           value={formData.apiKey}
                           onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                           className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                           required
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700">
                           API Secret *
                         </label>
                         <input
                           type="password"
                           value={formData.apiSecret}
                           onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                           className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                           required
                         />
                       </div>

                       <div>
                         <label className="block text-sm font-medium text-gray-700">
                           Request Token
                         </label>
                         <input
                           type="text"
                           value={formData.requestToken}
                           onChange={(e) => setFormData({ ...formData, requestToken: e.target.value })}
                           className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                           placeholder="From login flow"
                         />
                       </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleCloseDialog}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={addAccountMutation.isPending || updateAccountMutation.isPending}
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {editingAccount ? 'Update' : 'Add'} Account
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Messages Display */}
      {messages.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-center p-4 rounded-lg shadow-lg border-l-4 ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-400 text-green-800'
                  : message.type === 'error'
                  ? 'bg-red-50 border-red-400 text-red-800'
                  : 'bg-blue-50 border-blue-400 text-blue-800'
              }`}
            >
              <div className="flex-shrink-0">
                {message.type === 'success' && (
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                )}
                {message.type === 'error' && (
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                )}
                {message.type === 'info' && (
                  <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">{message.message}</p>
                <p className="text-xs opacity-75">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => removeMessage(message.id)}
                  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    message.type === 'success'
                      ? 'text-green-400 hover:bg-green-100 focus:ring-green-500'
                      : message.type === 'error'
                      ? 'text-red-400 hover:bg-red-100 focus:ring-red-500'
                      : 'text-blue-400 hover:bg-blue-100 focus:ring-blue-500'
                  }`}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
} 