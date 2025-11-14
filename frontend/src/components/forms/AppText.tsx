import React from 'react';
import { TEXT_COLORS, FONT_SIZES, FONT_WEIGHTS } from '../../constants/Constants';

interface AppTextProps {
  children: React.ReactNode;
  
  // Element type
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';
  
  // Typography
  size?: keyof typeof FONT_SIZES;
  weight?: keyof typeof FONT_WEIGHTS;
  color?: keyof typeof TEXT_COLORS;
  
  // Alignment
  align?: 'left' | 'center' | 'right' | 'justify';
  
  // Styling
  truncate?: boolean;
  italic?: boolean;
  underline?: boolean;
  lineThrough?: boolean;
  uppercase?: boolean;
  lowercase?: boolean;
  capitalize?: boolean;
  
  // Additional classes
  className?: string;
  
  // Events
  onClick?: () => void;
  
  // Accessibility
  id?: string;
  htmlFor?: string;
  title?: string;
}

/**
 * AppText Component
 * 
 * A flexible text component that uses Tailwind CSS for consistent styling
 * throughout the application. Supports dark mode, multiple text variants,
 * and semantic HTML elements.
 * 
 * @example
 * ```tsx
 * <AppText>Default paragraph text</AppText>
 * <AppText as="h1" size="3xl" weight="bold">Heading</AppText>
 * <AppText color="primary" weight="semibold">Primary text</AppText>
 * <AppText as="span" size="sm" color="muted">Small muted text</AppText>
 * ```
 */
const AppText: React.FC<AppTextProps> = ({
  children,
  as = 'p',
  size = 'base',
  weight = 'normal',
  color = 'default',
  align = 'left',
  truncate = false,
  italic = false,
  underline = false,
  lineThrough = false,
  uppercase = false,
  lowercase = false,
  capitalize = false,
  className = '',
  onClick,
  id,
  htmlFor,
  title,
}) => {
  const Component = as;
  
  // Build class names
  const classes = [
    FONT_SIZES[size],
    FONT_WEIGHTS[weight],
    TEXT_COLORS[color],
    // Alignment
    align === 'left' && 'text-left',
    align === 'center' && 'text-center',
    align === 'right' && 'text-right',
    align === 'justify' && 'text-justify',
    // Text modifiers
    truncate && 'truncate',
    italic && 'italic',
    underline && 'underline',
    lineThrough && 'line-through',
    uppercase && 'uppercase',
    lowercase && 'lowercase',
    capitalize && 'capitalize',
    // Clickable
    onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
    // Additional classes
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const props: any = {
    className: classes,
    onClick,
    id,
    title,
  };

  // Add htmlFor for label elements
  if (as === 'label' && htmlFor) {
    props.htmlFor = htmlFor;
  }

  return <Component {...props}>{children}</Component>;
};

export default AppText;