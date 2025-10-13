import React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthMeterProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const requirements: PasswordRequirement[] = [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Contains number', met: /[0-9]/.test(password) },
    { label: 'Contains special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const metCount = requirements.filter(req => req.met).length;
  const strength = metCount === 0 ? 0 : (metCount / requirements.length) * 100;

  const getStrengthLabel = () => {
    if (metCount === 0) return '';
    if (metCount <= 2) return 'Weak';
    if (metCount <= 3) return 'Fair';
    if (metCount <= 4) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (metCount === 0) return '';
    if (metCount <= 2) return 'bg-destructive';
    if (metCount <= 3) return 'bg-yellow-500';
    if (metCount <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${strength}%` }}
          />
        </div>
        {getStrengthLabel() && (
          <span className={cn("text-xs font-medium", {
            'text-destructive': metCount <= 2,
            'text-yellow-600': metCount === 3,
            'text-blue-600': metCount === 4,
            'text-green-600': metCount === 5,
          })}>
            {getStrengthLabel()}
          </span>
        )}
      </div>
      
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li
            key={index}
            className={cn(
              "text-xs flex items-center gap-2 transition-colors",
              req.met ? "text-green-600" : "text-muted-foreground"
            )}
          >
            <span className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center",
              req.met ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
            )}>
              {req.met ? "✓" : "○"}
            </span>
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function validatePasswordStrength(password: string): { isValid: boolean; message: string } {
  if (password.length < 12) {
    return { isValid: false, message: 'Password must be at least 12 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*...)' };
  }
  return { isValid: true, message: 'Password meets all requirements' };
}
