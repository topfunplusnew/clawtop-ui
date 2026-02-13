
import React from 'react';

const Header: React.FC = () => {
  return (
    <div className="flex items-center justify-center p-4 bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-2">
        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
        <h1 className="text-xl font-semibold text-gray-800">超级斜杠AI</h1>
      </div>
    </div>
  );
};

export default Header;
