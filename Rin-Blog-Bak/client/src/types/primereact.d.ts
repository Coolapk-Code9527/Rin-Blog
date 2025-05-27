// PrimeReact Calendar组件类型声明
declare module 'primereact/calendar' {
  import * as React from 'react';
  
  export interface CalendarChangeParams {
    originalEvent: Event;
    value: Date | Date[] | null;
  }
  
  export interface CalendarProps {
    id?: string;
    value?: Date | Date[] | null;
    onChange?: (e: CalendarChangeParams) => void;
    showTime?: boolean;
    showSeconds?: boolean;
    hourFormat?: string;
    showIcon?: boolean;
    touchUI?: boolean;
    dateFormat?: string;
    inline?: boolean;
    readOnlyInput?: boolean;
    disabled?: boolean;
    minDate?: Date;
    maxDate?: Date;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
    view?: 'date' | 'month' | 'year';
    monthNavigator?: boolean;
    yearNavigator?: boolean;
    disabledDates?: Date[];
    disabledDays?: number[];
    locale?: string;
    timeOnly?: boolean;
  }
  
  export class Calendar extends React.Component<CalendarProps> {}
} 