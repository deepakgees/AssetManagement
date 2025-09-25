import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import { 
  getSymbolAndMargins, 
  createSymbolAndMargin, 
  updateSymbolAndMargin, 
  deleteSymbolAndMargin,
  syncCommodities,
  syncEquities,
  type SymbolAndMargin,
  type CreateSymbolAndMarginData,
  type UpdateSymbolAndMarginData
} from '../services/symbolAndMarginsService';

interface Message {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface SymbolAndMarginFormData {
  symbolPrefix: string;
  margin: string;
}

export default function SymbolAndMargins() {
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SymbolAndMargin | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [formData, setFormData] = useState<SymbolAndMarginFormData>({
    symbolPrefix: '',
    margin: '',
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

  // API calls
  const { data: records, isLoading } = useQuery({
    queryKey: ['symbolAndMargins'],
    queryFn: getSymbolAndMargins,
    refetchInterval: 30000,
  });

  const addRecordMutation = useMutation({
    mutationFn: (newRecord: CreateSymbolAndMarginData) => createSymbolAndMargin(newRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbolAndMargins'] });
      handleCloseDialog();
      addMessage('success', 'Symbol and margin record created successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to create record: ${error.response?.data?.message || error.message}`);
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & UpdateSymbolAndMarginData) => updateSymbolAndMargin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbolAndMargins'] });
      handleCloseDialog();
      addMessage('success', 'Symbol and margin record updated successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to update record: ${error.response?.data?.message || error.message}`);
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: deleteSymbolAndMargin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symbolAndMargins'] });
      addMessage('success', 'Symbol and margin record deleted successfully!');
    },
    onError: (error: any) => {
      addMessage('error', `Failed to delete record: ${error.response?.data?.message || error.message}`);
    },
  });

  const syncCommoditiesMutation = useMutation({
    mutationFn: syncCommodities,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['symbolAndMargins'] });
      addMessage('success', `Commodities synced successfully! Created: ${data.stats.created}, Updated: ${data.stats.updated}`);
    },
    onError: (error: any) => {
      addMessage('error', `Failed to sync commodities: ${error.response?.data?.message || error.message}`);
    },
  });

  const syncEquitiesMutation = useMutation({
    mutationFn: syncEquities,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['symbolAndMargins'] });
      addMessage('success', `Equities synced successfully! Created: ${data.stats.created}, Updated: ${data.stats.updated}`);
    },
    onError: (error: any) => {
      addMessage('error', `Failed to sync equities: ${error.response?.data?.message || error.message}`);
    },
  });

  const handleOpenDialog = (record?: SymbolAndMargin) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        symbolPrefix: record.symbolPrefix,
        margin: record.margin.toString(),
      });
    } else {
      setEditingRecord(null);
      setFormData({
        symbolPrefix: '',
        margin: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRecord(null);
    setFormData({
      symbolPrefix: '',
      margin: '',
    });
  };

  const handleSubmit = () => {
    if (!formData.symbolPrefix.trim()) {
      addMessage('error', 'Please fill in the symbol prefix');
      return;
    }

    if (!formData.margin.trim() || isNaN(parseFloat(formData.margin)) || parseFloat(formData.margin) < 0) {
      addMessage('error', 'Please enter a valid positive margin value');
      return;
    }

    const marginValue = parseFloat(formData.margin);

    if (editingRecord) {
      updateRecordMutation.mutate({
        id: editingRecord.id,
        symbolPrefix: formData.symbolPrefix.trim(),
        margin: marginValue,
      });
    } else {
      addRecordMutation.mutate({
        symbolPrefix: formData.symbolPrefix.trim(),
        margin: marginValue,
      });
    }
  };

  const handleDelete = (recordId: number) => {
    if (window.confirm('Are you sure you want to delete this symbol and margin record?')) {
      deleteRecordMutation.mutate(recordId);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Symbol and Margin Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => syncCommoditiesMutation.mutate()}
            disabled={syncCommoditiesMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncCommoditiesMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            ) : (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncCommoditiesMutation.isPending ? 'Syncing...' : 'Sync Commodities'}
          </button>
          <button
            onClick={() => syncEquitiesMutation.mutate()}
            disabled={syncEquitiesMutation.isPending}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncEquitiesMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            ) : (
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {syncEquitiesMutation.isPending ? 'Syncing...' : 'Sync Equities'}
          </button>
          <button
            onClick={() => handleOpenDialog()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Record
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Symbol and Margin Records ({records?.length || 0})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage symbol prefixes and their corresponding margin values
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Symbol Prefix
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Margin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Updated
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records?.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{record.symbolPrefix}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{record.margin.toFixed(2)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(record.updatedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button
                      onClick={() => handleOpenDialog(record)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                      title="Edit Record"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Record"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {records?.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No symbol and margin records found</div>
            <div className="text-gray-400 text-sm mt-2">Click "Add Record" to create your first record</div>
          </div>
        )}
      </div>

      {/* Add/Edit Record Dialog */}
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
                      {editingRecord ? 'Edit Symbol and Margin Record' : 'Add New Symbol and Margin Record'}
                    </Dialog.Title>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Symbol Prefix *
                        </label>
                        <input
                          type="text"
                          value={formData.symbolPrefix}
                          onChange={(e) => setFormData({ ...formData, symbolPrefix: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="e.g., RELIANCE, TCS, INFY"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Margin *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.margin}
                          onChange={(e) => setFormData({ ...formData, margin: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="e.g., 1000.50"
                          required
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
                      disabled={addRecordMutation.isPending || updateRecordMutation.isPending}
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                    >
                      {editingRecord ? 'Update' : 'Add'} Record
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
