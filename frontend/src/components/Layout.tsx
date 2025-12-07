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
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTradesOpen, setCurrentTradesOpen] = useState(true);
  const [performanceOpen, setPerformanceOpen] = useState(true);
  const [nextTradesOpen, setNextTradesOpen] = useState(true);
  const location = useLocation();

  const navigation = [
    { name: 'Accounts', href: '/accounts', icon: UserGroupIcon },
    { 
      name: 'Current Trades', 
      icon: ChartBarIcon,
      children: [
        { name: 'Holdings', href: '/holdings', icon: HomeIcon },
        { name: 'Positions', href: '/positions', icon: ChartBarIcon },
      ]
    },
    { 
      name: 'Next Trades', 
      icon: TagIcon,
      children: [
        { name: 'Symbol & Margins', href: '/symbolMargins', icon: TagIcon },
        { name: 'Historical Data', href: '/historicalData', icon: ClockIcon },
        { name: 'Holding Category Mapping', href: '/holdingCategoryMapping', icon: TagIcon },
      ]
    },
    { 
      name: 'Performance', 
      icon: CurrencyDollarIcon,
      children: [
        { name: 'P&L', href: '/pnl', icon: CurrencyDollarIcon },
        { name: 'Dividends', href: '/dividends', icon: CurrencyDollarIcon },
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
            }`}
          >
            <item.icon
              className={`mr-3 h-6 w-6 flex-shrink-0 ${
                hasActiveChild ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
              }`}
            />
            {item.name}
            {isOpen ? (
              <ChevronDownIcon className="ml-auto h-4 w-4" />
            ) : (
              <ChevronRightIcon className="ml-auto h-4 w-4" />
            )}
          </button>
          {isOpen && (
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
          }`}
          onClick={() => isMobile && setSidebarOpen(false)}
        >
          <item.icon
            className={`mr-3 h-6 w-6 flex-shrink-0 ${
              isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'
            }`}
          />
          {item.name}
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
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4">
            <h1 className="text-lg font-semibold text-gray-900">Asset Management</h1>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => renderNavigationItem(item, false))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">

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