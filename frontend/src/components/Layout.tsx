import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  XMarkIcon,
  TagIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentTradesOpen, setCurrentTradesOpen] = useState(true);
  const [performanceOpen, setPerformanceOpen] = useState(true);
  const [nextTradesOpen, setNextTradesOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: 'Accounts', href: '/accounts', icon: UserGroupIcon },
    { 
      name: 'Next Trades', 
      icon: TagIcon,
      children: [
        { name: 'Symbol & Margins', href: '/symbolMargins', icon: TagIcon },
        { name: 'Historical Data', href: '/historicalData', icon: ClockIcon },
        { name: 'Holding Category Mapping', href: '/holdingCategoryMapping', icon: TagIcon },
      ]
    },
  ];

  const renderNavigationItem = (item: any, isMobile: boolean = false) => {
    if (item.children) {
      // Render collapsible section
      const hasActiveChild = item.children.some((child: any) => location.pathname === child.href);
      const isOpen = item.name === 'Current Trades' ? currentTradesOpen : 
                     item.name === 'Performance' ? performanceOpen : nextTradesOpen;
      const toggleOpen = item.name === 'Current Trades' ? setCurrentTradesOpen : 
                         item.name === 'Performance' ? setPerformanceOpen : setNextTradesOpen;
      
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleOpen(!isOpen)}
            className={`group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md ${
              hasActiveChild
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            } ${sidebarCollapsed && !isMobile ? 'justify-center' : ''}`}
            title={sidebarCollapsed && !isMobile ? item.name : undefined}
          >
            <item.icon
              className={`h-6 w-6 flex-shrink-0 ${
                hasActiveChild ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
              } ${sidebarCollapsed && !isMobile ? '' : 'mr-3'}`}
            />
            {(!sidebarCollapsed || isMobile) && (
              <>
                <span className="flex-1 text-left">{item.name}</span>
                {isOpen ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </>
            )}
          </button>
          {isOpen && (!sidebarCollapsed || isMobile) && (
            <div className="ml-4 space-y-1">
              {item.children.map((child: any) => {
                const isActive = location.pathname === child.href;
                return (
                  <Link
                    key={child.name}
                    to={child.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => isMobile && setSidebarOpen(false)}
                  >
                    <child.icon
                      className={`mr-3 h-6 w-6 flex-shrink-0 ${
                        isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {child.name}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    } else {
      // Render regular navigation item
      const isActive = location.pathname === item.href;
      return (
        <Link
          key={item.name}
          to={item.href}
          className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
            isActive
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          } ${sidebarCollapsed && !isMobile ? 'justify-center' : ''}`}
          onClick={() => isMobile && setSidebarOpen(false)}
          title={sidebarCollapsed && !isMobile ? item.name : undefined}
        >
          <item.icon
            className={`h-6 w-6 flex-shrink-0 ${
              isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
            } ${sidebarCollapsed && !isMobile ? '' : 'mr-3'}`}
          />
          {(!sidebarCollapsed || isMobile) && <span>{item.name}</span>}
        </Link>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <h1 className="text-lg font-semibold text-gray-900">Asset Management</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => renderNavigationItem(item, true))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
      }`}>
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className={`flex h-16 items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-4 justify-between'}`}>
            {!sidebarCollapsed && (
              <h1 className="text-lg font-semibold text-gray-900">Asset Management</h1>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => renderNavigationItem(item, false))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Mobile menu button */}
        <div className="lg:hidden fixed top-4 left-4 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 