
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 00-4-4H3V9h2a4 4 0 004-4V3l7 7-7 7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17v-2a4 4 0 014-4h2V9h-2a4 4 0 01-4-4V3l7 7-7 7z" />
             </svg>
            <span className="text-xl font-bold ml-3 text-gray-900">© Corporate Carbon Group of Companies</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;