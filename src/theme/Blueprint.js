import React from 'react';

export default function Blueprint({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`blueprint ${className}`.trim()} {...rest}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </Tag>
  );
}
