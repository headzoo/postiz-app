const React = require('react');

const OverlayScrollbarsComponent = ({ children, className, id, style }) =>
  React.createElement('div', { className, id, style }, children);

module.exports = {
  OverlayScrollbarsComponent,
};
