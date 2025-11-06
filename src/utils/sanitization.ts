import DOMPurify from 'dompurify';

// Configuration for DOMPurify to allow only safe HTML elements
const sanitizeConfig = {
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'span', 'div'],
  ALLOWED_ATTR: ['class', 'style'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false
};

export const sanitizeUserInput = (input: string): string => {
  if (!input) return '';
  
  // First, strip any HTML tags by converting to text
  const stripped = input.replace(/<[^>]*>/g, '');
  
  // Then sanitize any potential remaining malicious content
  const clean = DOMPurify.sanitize(stripped, sanitizeConfig);
  
  // Additional basic sanitization
  return clean
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*javascript:[^>]*>/gi, '');
};

export const validateNumericInput = (value: string): string => {
  // Allow only numbers, commas, periods, parentheses, and minus signs
  return value.replace(/[^0-9,.\-\(\)\s]/g, '');
};

export const formatCurrencyInput = (value: string): string => {
  // Clean and format currency input
  const clean = validateNumericInput(value);
  // Add formatting logic if needed
  return clean;
};

export const isValidInput = (input: string, maxLength: number = 1000): boolean => {
  return input.length > 0 && input.length <= maxLength;
};