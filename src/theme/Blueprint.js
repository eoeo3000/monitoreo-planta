import React, { forwardRef } from 'react';

const Blueprint = forwardRef(function Blueprint({ as: Tag = 'div', className = '', children, ...rest }, ref) {
  return (
    <Tag ref={ref} className={`blueprint ${className}`.trim()} {...rest}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </Tag>
  );
});

export default Blueprint;
