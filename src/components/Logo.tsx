import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const textMap = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-bold',
    xl: 'text-3xl font-extrabold',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${sizeMap[size]} shrink-0 rounded-xl overflow-hidden border border-[#DDF4EA] shadow-2xs bg-[#E8F8F0]`}>
        <img
          src="/favicon.svg"
          alt="SIRKULA Logo"
          className="w-full h-full object-contain p-1"
          loading="eager"
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`tracking-tight text-[#0B3D2E] ${textMap[size]}`}>SIRKULA</span>
          <span className="text-[10px] text-[#667085] font-medium tracking-wider uppercase mt-0.5">
            Daur Ulang Terverifikasi
          </span>
        </div>
      )}
    </div>
  );
};
