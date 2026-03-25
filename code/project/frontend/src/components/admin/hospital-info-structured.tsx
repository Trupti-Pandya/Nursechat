'use client';

import { useState } from 'react';
import HospitalInfoForm from '../../app/admin/hospital-info/structured-form/hospital-info-form';

export function HospitalInfoStructured() {
  return (
    <div className="h-full overflow-hidden">
      <HospitalInfoForm />
    </div>
  );
} 