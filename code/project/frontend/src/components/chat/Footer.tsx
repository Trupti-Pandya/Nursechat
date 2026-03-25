"use client";

import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="text-center py-2 text-gray-500 text-xs">
      © {currentYear} NurseChat · Medical Support Assistant · 
      <a href="#" className="text-gray-500 hover:text-gray-700 ml-1">Privacy Policy</a>
    </footer>
  );
} 