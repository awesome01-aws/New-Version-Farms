import React from 'react';

const awsLogo = '/src/assets/images/regenerated_image_1786097911978.png';

export default function Footer() {
  return (
    <footer className="w-full py-6 mt-12 border-t border-slate-200/80 bg-slate-50/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-bold text-slate-500 select-none">
      <span className="text-slate-500 font-semibold tracking-wide">Made by</span>
      <div 
        className="inline-flex items-center justify-center p-1 rounded-full bg-white shadow-2xs border border-slate-200/80 hover:border-emerald-300 transition-all cursor-pointer group"
        title="AWS Monogram"
      >
        <img 
          src={awsLogo} 
          alt="AWS Monogram Logo" 
          referrerPolicy="no-referrer"
          className="w-7 h-7 sm:w-8 sm:h-8 object-contain transition-transform group-hover:scale-110"
        />
      </div>
    </footer>
  );
}
