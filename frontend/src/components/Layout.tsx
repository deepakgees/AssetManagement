import { Fragment, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Holdings', href: '/holdings', icon: ChartBarIcon },
  { name: 'Positions', href: '/positions', icon: ChartBarIcon },
  { name: 'P&L', href: '/pnl', icon: CurrencyDollarIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Accounts', href: '/accounts', icon: UserGroupIcon },

];

export default function Layout({ children, title, showRefresh = false, onRefresh }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      // You can add a toast notification here if needed
      console.log('Data refreshed!');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Mobile sidebar */}
        <Transition.Root show={sidebarOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-900/80" />
            </Transition.Child>

            <div className="fixed inset-0 flex">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                  <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
                    <div className="flex h-16 shrink-0 items-center">
                      <h1 className="text-xl font-semibold text-gray-900">Portfolio Tracker</h1>
                    </div>
                    <nav className="flex flex-1 flex-col">
                      <ul role="list" className="flex flex-1 flex-col gap-y-7">
                        <li>
                          <ul role="list" className="-mx-2 space-y-1">
                            {navigation.map((item) => (
                              <li key={item.name}>
                                <a
                                  href={item.href}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate(item.href);
                                    setSidebarOpen(false);
                                  }}
                                  className={`
                                    group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                                    ${location.pathname === item.href
                                      ? 'bg-primary-600 text-white'
                                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                    }
                                  `}
                                >
                                  <item.icon
                                    className={`h-6 w-6 shrink-0 ${
                                      location.pathname === item.href ? 'text-white' : 'text-gray-400 group-hover:text-primary-600'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {item.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </li>
                      </ul>
                    </nav>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>

        {/* Static sidebar for desktop */}
        <div className={`hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
        }`}>
          <div className={`flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white pb-4 ${
            sidebarCollapsed ? 'px-2' : 'px-6'
          }`}>
            <div className={`flex h-16 shrink-0 items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && (
                <h1 className="text-xl font-semibold text-gray-900">Portfolio Tracker</h1>
              )}
              {sidebarCollapsed && (
                <h1 className="text-lg font-semibold text-gray-900">PT</h1>
              )}
              {!sidebarCollapsed && (
                <button
                  type="button"
                  className="rounded-md p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  <span className="sr-only">Toggle sidebar</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {navigation.map((item) => (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(item.href);
                          }}
                          className={`
                            group flex ${sidebarCollapsed ? 'justify-center' : 'gap-x-3'} rounded-md p-2 text-sm leading-6 font-semibold
                            ${location.pathname === item.href
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                            }
                          `}
                          title={sidebarCollapsed ? item.name : undefined}
                        >
                          <item.icon
                            className={`h-6 w-6 shrink-0 ${
                              location.pathname === item.href ? 'text-white' : 'text-gray-400 group-hover:text-primary-600'
                            }`}
                            aria-hidden="true"
                          />
                          {!sidebarCollapsed && item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className={`transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        }`}>
          {/* Top bar */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center">
                {title && (
                  <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
                )}
              </div>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                {/* Desktop sidebar toggle button */}
                <button
                  type="button"
                  className="hidden lg:block rounded-md p-1.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <span className="sr-only">Toggle sidebar</span>
                  {sidebarCollapsed ? (
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
                
                {showRefresh && (
                  <button
                    type="button"
                    className="rounded-full bg-white p-1.5 text-gray-400 hover:text-gray-500"
                    onClick={handleRefresh}
                  >
                    <span className="sr-only">Refresh data</span>
                    <ArrowPathIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
} 