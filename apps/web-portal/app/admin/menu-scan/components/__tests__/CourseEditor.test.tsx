import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EditableCourse } from '@/lib/menu-scan';
import { useReviewStore } from '../../store';
import { CourseEditor } from '../CourseEditor';

// ---------------------------------------------------------------------------
// Mock @dnd-kit to avoid pointer-event complexity in tests
// ---------------------------------------------------------------------------

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: {},
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

// Always show collapsible content in tests
vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
  formatLocationForSupabase: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDish(courses: EditableCourse[] = []) {
  return {
    _id: 'dish-1',
    name: 'Test Dish',
    price: '0',
    description: '',
    dietary_tags: [],
    spice_level: null,
    calories: null,
    dish_category_id: null,
    confidence: 0.9,
    ingredients: [],
    dish_kind: 'course_menu' as const,
    is_parent: true,
    serves: null,
    display_price_prefix: 'per_person' as const,
    primary_protein: null,
    variant_ids: [],
    parent_id: null,
    group_status: 'ai_proposed' as const,
    courses,
  };
}

const mockActions = {
  addCourse: vi.fn(),
  removeCourse: vi.fn(),
  reorderCourses: vi.fn(),
  updateCourseField: vi.fn(),
  addCourseItem: vi.fn(),
  removeCourseItem: vi.fn(),
  reorderCourseItems: vi.fn(),
  updateCourseItem: vi.fn(),
};

function setStoreWithDish(courses: EditableCourse[] = []) {
  useReviewStore.setState({
    ...mockActions,
    editableMenus: [
      {
        name: 'Menu',
        menu_type: 'food',
        categories: [{ name: 'Cat', dishes: [makeDish(courses)] }],
      },
    ],
  } as never);
}

function makeCourse(overrides: Partial<EditableCourse> = {}): EditableCourse {
  return {
    _id: `c-${Math.random()}`,
    course_number: 1,
    course_name: 'Starter',
    choice_type: 'one_of',
    required_count: 1,
    items: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CourseEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStoreWithDish();
  });

  it('renders the course editor container', () => {
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getByTestId('course-editor')).toBeInTheDocument();
  });

  it('shows empty-state text when no courses', () => {
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
  });

  it('renders 2 courses with correct card count', () => {
    setStoreWithDish([
      makeCourse({ _id: 'c1', course_number: 1, course_name: 'Starter', items: [] }),
      makeCourse({ _id: 'c2', course_number: 2, course_name: 'Main', items: [] }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getAllByTestId('course-card')).toHaveLength(2);
  });

  it('renders 2 courses × 2 items each (4 item rows)', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        course_name: 'Starter',
        items: [
          { _id: 'i1', option_label: 'Soup', price_delta: 0 },
          { _id: 'i2', option_label: 'Salad', price_delta: 0 },
        ],
      }),
      makeCourse({
        _id: 'c2',
        course_name: 'Main',
        items: [
          { _id: 'i3', option_label: 'Fish', price_delta: 0 },
          { _id: 'i4', option_label: 'Steak', price_delta: 0 },
        ],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getAllByTestId('course-card')).toHaveLength(2);
    expect(screen.getAllByTestId('course-item-row')).toHaveLength(4);
  });

  it('renders fixed-option input (single layout) for choice_type=fixed', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        choice_type: 'fixed',
        items: [{ _id: 'i1', option_label: 'Amuse-bouche', price_delta: 0 }],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getByTestId('fixed-option-input')).toBeInTheDocument();
    expect(screen.queryByTestId('add-item-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('items-list')).not.toBeInTheDocument();
  });

  it('renders items list and add-item button for choice_type=one_of', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        choice_type: 'one_of',
        items: [{ _id: 'i1', option_label: 'Soup', price_delta: 0 }],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getByTestId('items-list')).toBeInTheDocument();
    expect(screen.getByTestId('add-item-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('fixed-option-input')).not.toBeInTheDocument();
  });

  it('calls addCourse(dishId) when "Add course" button clicked', () => {
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.click(screen.getByTestId('add-course-btn'));
    expect(mockActions.addCourse).toHaveBeenCalledOnce();
    expect(mockActions.addCourse).toHaveBeenCalledWith('dish-1');
  });

  it('calls removeCourse(dishId, 0) when delete course button clicked', () => {
    setStoreWithDish([makeCourse({ _id: 'c1' })]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.click(screen.getByTestId('remove-course-btn'));
    expect(mockActions.removeCourse).toHaveBeenCalledOnce();
    expect(mockActions.removeCourse).toHaveBeenCalledWith('dish-1', 0);
  });

  it('calls addCourseItem(dishId, 0) when "Add item" button clicked', () => {
    setStoreWithDish([makeCourse({ _id: 'c1', choice_type: 'one_of', items: [] })]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.click(screen.getByTestId('add-item-btn'));
    expect(mockActions.addCourseItem).toHaveBeenCalledOnce();
    expect(mockActions.addCourseItem).toHaveBeenCalledWith('dish-1', 0);
  });

  it('calls removeCourseItem(dishId, 0, 0) when delete item button clicked', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        choice_type: 'one_of',
        items: [{ _id: 'i1', option_label: 'Soup', price_delta: 0 }],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.click(screen.getByTestId('remove-item-btn'));
    expect(mockActions.removeCourseItem).toHaveBeenCalledOnce();
    expect(mockActions.removeCourseItem).toHaveBeenCalledWith('dish-1', 0, 0);
  });

  it('calls updateCourseField when course name input changes', () => {
    setStoreWithDish([makeCourse({ _id: 'c1', course_name: 'Starter' })]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.change(screen.getByTestId('course-name-input'), {
      target: { value: 'Appetizer' },
    });
    expect(mockActions.updateCourseField).toHaveBeenCalledWith('dish-1', 0, {
      course_name: 'Appetizer',
    });
  });

  it('calls updateCourseField when choice_type select changes', () => {
    setStoreWithDish([makeCourse({ _id: 'c1', choice_type: 'one_of' })]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.change(screen.getByTestId('choice-type-select'), {
      target: { value: 'fixed' },
    });
    expect(mockActions.updateCourseField).toHaveBeenCalledWith('dish-1', 0, {
      choice_type: 'fixed',
    });
  });

  it('calls updateCourseItem when item label input changes', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        choice_type: 'one_of',
        items: [{ _id: 'i1', option_label: 'Soup', price_delta: 0 }],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    fireEvent.change(screen.getByTestId('item-label-input'), {
      target: { value: 'Bisque' },
    });
    expect(mockActions.updateCourseItem).toHaveBeenCalledWith('dish-1', 0, 0, {
      option_label: 'Bisque',
    });
  });

  it('renders drag handles on courses and items', () => {
    setStoreWithDish([
      makeCourse({
        _id: 'c1',
        choice_type: 'one_of',
        items: [{ _id: 'i1', option_label: 'Soup', price_delta: 0 }],
      }),
    ]);
    render(<CourseEditor dishId="dish-1" />);
    expect(screen.getByTestId('course-drag-handle')).toBeInTheDocument();
    expect(screen.getByTestId('item-drag-handle')).toBeInTheDocument();
  });
});
