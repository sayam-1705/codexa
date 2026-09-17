export default {
  apiVersion: 1,
  name: 'Fixture Adapter',
  language: 'fixture',
  version: '1.0.0',
  extensions: ['.fixture'],
  async detect() {
    return true;
  },
  async lint() {
    return [];
  },
  async fix() {
    return { success: false, diff: null, message: 'No fix available' };
  }
};
