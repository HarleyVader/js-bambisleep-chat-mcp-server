const {
    generateRandomString,
    generateUniqueId,
    isValidEmail,
    sanitizeString,
    isEmpty,
    deepClone
} = require('../src/utils');

describe('Utility Functions', () => {
    describe('generateRandomString', () => {
        test('should generate string of correct length', () => {
            const str = generateRandomString(10);
            expect(str).toHaveLength(10);
        });

        test('should generate different strings each time', () => {
            const str1 = generateRandomString(10);
            const str2 = generateRandomString(10);
            expect(str1).not.toBe(str2);
        });
    });

    describe('generateUniqueId', () => {
        test('should generate ID with prefix', () => {
            const id = generateUniqueId('test');
            expect(id).toMatch(/^test_\d+_[a-zA-Z0-9]{8}$/);
        });

        test('should generate different IDs each time', () => {
            const id1 = generateUniqueId('test');
            const id2 = generateUniqueId('test');
            expect(id1).not.toBe(id2);
        });
    });

    describe('isValidEmail', () => {
        test('should validate correct email addresses', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        });

        test('should reject invalid email addresses', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('test@')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
        });
    });

    describe('sanitizeString', () => {
        test('should remove dangerous characters', () => {
            const result = sanitizeString('<script>alert("xss")</script>');
            expect(result).not.toContain('<');
            expect(result).not.toContain('>');
        });

        test('should trim whitespace', () => {
            const result = sanitizeString('  test  ');
            expect(result).toBe('test');
        });
    });

    describe('isEmpty', () => {
        test('should detect empty values', () => {
            expect(isEmpty(null)).toBe(true);
            expect(isEmpty(undefined)).toBe(true);
            expect(isEmpty('')).toBe(true);
            expect(isEmpty('   ')).toBe(true);
            expect(isEmpty([])).toBe(true);
            expect(isEmpty({})).toBe(true);
        });

        test('should detect non-empty values', () => {
            expect(isEmpty('test')).toBe(false);
            expect(isEmpty([1, 2, 3])).toBe(false);
            expect(isEmpty({ key: 'value' })).toBe(false);
            expect(isEmpty(0)).toBe(false);
        });
    });

    describe('deepClone', () => {
        test('should clone objects deeply', () => {
            const original = { a: 1, b: { c: 2 } };
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned.b).not.toBe(original.b);
        });

        test('should handle arrays', () => {
            const original = [1, [2, 3], { a: 4 }];
            const cloned = deepClone(original);

            expect(cloned).toEqual(original);
            expect(cloned).not.toBe(original);
            expect(cloned[1]).not.toBe(original[1]);
        });
    });
});
