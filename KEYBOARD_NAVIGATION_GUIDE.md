# Keyboard Navigation Guide

This guide documents keyboard accessibility features in QuickSwap and provides testing procedures.

## Overview

QuickSwap supports full keyboard navigation for users who prefer or require keyboard input. All interactive elements are accessible via keyboard without requiring a mouse.

### Key Features Implemented
- ✅ Tab navigation through all interactive elements
- ✅ ESC key closes modals
- ✅ Enter/Space to activate buttons
- ✅ Skip to main content link
- ✅ Focus visible indicators
- ✅ Semantic HTML for screen readers

---

## Tab Order & Navigation

### Landing Page
```
1. Skip to main content link
2. Start selling button
3. Sign in button (unauthenticated)
4. Navigation links (How it works, Live auctions, Why Quickswap)
5. Product cards (interactive)
6. CTA buttons
7. Footer links
```

### Authenticated Home Page
```
1. Skip to main content link
2. Start selling button
3. Explore link
4. Profile button
5. Logout button
6. Product cards
7. Auction detail links
```

### Modals (Profile, Settings, Address, Payment)
```
1. Form inputs (in order)
2. Cancel button
3. Submit button
4. ESC key closes modal
```

### Auction Detail Page
```
1. Back button
2. Main image
3. Thumbnail images
4. Bid input field
5. Bid submit button
6. Seller contact info
```

---

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `Tab` | Move to next element | Global |
| `Shift+Tab` | Move to previous element | Global |
| `Enter` | Activate button/link | Buttons, links, form submit |
| `Space` | Activate button | Buttons |
| `Escape` | Close modal | Modal dialogs |
| `Arrow Down` | Next option | Dropdowns, image carousel |
| `Arrow Up` | Previous option | Dropdowns, image carousel |

---

## Focus Indicators

### Default Browser Focus
- Blue outline around focused elements
- 2px solid outline with 2px offset
- Color: `var(--primary)` (#2563eb)

### Custom Focus Styles
```css
.btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 0;
}
```

### Testing Focus Visibility
```bash
1. Open page in Chrome DevTools
2. Press Tab repeatedly
3. Verify: Blue outline appears around each element
4. Verify: Outline is clearly visible on all components
```

---

## Testing Procedures

### Basic Tab Navigation Test

**Objective:** Verify all interactive elements are reachable via Tab key

**Steps:**
```
1. Navigate to page
2. Press Tab to move forward through elements
3. Press Shift+Tab to move backward
4. Verify:
   - No elements are skipped
   - Focus doesn't trap (can escape any element)
   - Focus outline is clearly visible
   - Logical tab order (left-to-right, top-to-bottom)
```

**Expected Result:** All buttons, links, form inputs should be focusable

### Skip Navigation Link Test

**Objective:** Verify skip link works and is accessible

**Steps:**
```
1. Load any page
2. Press Tab once (focus should move to skip link)
3. Verify:
   - Link is visible or becomes visible on focus
   - Text says "Skip to main content"
4. Press Enter
5. Verify:
   - Page jumps to main content
   - Focus moves to #main-content
```

**Expected Result:** Page smoothly jumps past navigation

### Modal ESC Key Test

**Objective:** Verify modals close with ESC key

**Steps:**
1. Open Edit Profile modal (click Edit Profile button)
2. Fill in any field
3. Press ESC key
4. Verify:
   - Modal closes without saving
   - Focus returns to opening button
   - No form data submitted

**Locations to Test:**
- Edit Profile modal
- Update Password modal
- Delete Account modal
- Add Address modal
- Add Payment Method modal

**Expected Result:** All modals close with ESC

### Form Navigation Test

**Objective:** Verify form fields are navigable in correct order

**Steps:**
1. Open Settings > Add Address
2. Press Tab to navigate between fields
3. Verify order:
   - Full name
   - Street address 1
   - Street address 2
   - City
   - State/Region
   - Postal/ZIP
   - Country
   - Default address checkbox
   - Cancel button
   - Save button
4. Press Shift+Tab to move backward

**Expected Result:** Form inputs focus in logical order

### Screen Reader Testing

**Objective:** Verify content is readable by screen readers

**Tested with:**
- ✅ NVDA (Windows free tool)
- ✅ JAWS (Windows commercial)
- ✅ VoiceOver (Mac/iOS built-in)
- ✅ TalkBack (Android built-in)

**Test Steps for macOS VoiceOver:**
```
1. Enable VoiceOver: Cmd+F5
2. Press VO+U to open rotor
3. Navigate page structure
4. Verify all content is announced
```

**Test Steps for Windows NVDA:**
```
1. Download NVDA (https://www.nvaccess.org/)
2. Enable NVDA
3. Use arrow keys to navigate
4. Verify: Forms, links, buttons announced correctly
```

### Mobile Keyboard Test (iOS/Android)

**Objective:** Verify keyboard navigation on mobile devices

**iOS (Built-in Keyboard):**
```
1. Open page on iPhone/iPad
2. Show keyboard in Settings > Accessibility > Keyboard
3. Use arrow keys to navigate
4. Verify: All elements reachable
```

**Android (Built-in Keyboard):**
```
1. Open page on Android device
2. Enable keyboard navigation in Settings > Accessibility
3. Use Tab/arrow keys to navigate
4. Verify: All elements reachable
```

---

## Focus Management Best Practices

### When Opening a Modal
```tsx
useEffect(() => {
  // Focus moves to first input in modal
  inputRef?.current?.focus();
  
  return () => {
    // Focus returns to opening button
    openButtonRef?.current?.focus();
  };
}, [isOpen]);
```

### When Closing a Modal
```tsx
const closeModal = () => {
  setIsOpen(false);
  // Automatically focus returns to opener
};
```

### Focus Trap (Prevent Tab Escaping)
```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab' && isModalOpen) {
      // Trap focus within modal
      if (e.shiftKey && document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isModalOpen]);
```

---

## Common Issues & Solutions

### Issue: Focus outline not visible
**Solution:** Check CSS for `outline: none` rules. Use `focus-visible` instead of `focus`.

### Issue: Cannot Tab to a button
**Solution:** Verify button has `type="button"` not `type="submit"` outside forms.

### Issue: Modal doesn't trap focus
**Solution:** Implement focus trap with Tab key handler (see code above).

### Issue: Skip link not working
**Solution:** Verify `#main-content` element exists and is in DOM.

### Issue: Form submits on ESC instead of closing
**Solution:** Check for form elements capturing ESC and preventing propagation.

---

## Accessibility Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Tab order follows logical reading order
- [ ] Focus indicators are clearly visible
- [ ] Skip to main content link works
- [ ] All modals close with ESC
- [ ] Form fields tab in correct order
- [ ] No keyboard trap (can escape with Tab)
- [ ] Screen reader announces all content
- [ ] Alt text on all images
- [ ] Form labels associated with inputs
- [ ] Color not only way to convey info
- [ ] Sufficient color contrast (WCAG AA)

---

## Test Coverage Matrix

| Feature | Tab Nav | Focus | ESC | Screen Reader | Mobile |
|---------|---------|-------|-----|---------------|--------|
| Landing Page | ✅ | ✅ | - | ✅ | ✅ |
| Profile Page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auction Detail | ✅ | ✅ | - | ✅ | ✅ |
| Edit Profile Modal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Address Settings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Payment Settings | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Automated Testing

### Using Cypress for Keyboard Navigation

```typescript
describe('Keyboard Navigation', () => {
  it('should tab through all interactive elements', () => {
    cy.visit('/');
    
    // Tab to first element
    cy.get('body').tab();
    cy.focused().should('have.text', 'Skip to main content');
    
    // Tab to next
    cy.focused().tab();
    cy.focused().should('have.class', 'btn-primary');
  });

  it('should close modal with ESC', () => {
    cy.visit('/profile');
    cy.contains('Edit Profile').click();
    cy.get('[role="dialog"]').should('be.visible');
    
    cy.get('body').type('{Escape}');
    cy.get('[role="dialog"]').should('not.exist');
  });
});
```

### Using Axe for A11y Testing

```typescript
import { checkA11y } from 'axe-playwright';

test('page should not have accessibility violations', async ({ page }) => {
  await page.goto('https://quickswap.app');
  await checkA11y(page);
});
```

---

## Browser Support

| Browser | Keyboard Nav | Focus Visible | ESC Support |
|---------|--------------|---------------|-------------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| iOS Safari | ✅ | ⚠️ Limited | ✅ |
| Chrome Android | ✅ | ⚠️ Limited | ✅ |

---

## Resources

- [MDN: Keyboard Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Understanding_WCAG/Keyboard)
- [WebAIM: Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM: Focus Visible](https://webaim.org/articles/visual_order/)

---

## Maintenance

This guide should be updated whenever:
- New interactive components are added
- Modal dialogs are added/removed
- Tab order changes
- Form fields are reordered
- Navigation structure changes

Last Updated: 2026-04-28
Maintained by: Frontend Team
