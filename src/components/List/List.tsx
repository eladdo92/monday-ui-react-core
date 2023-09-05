import cx from "classnames";
import React, {
  AriaAttributes,
  CSSProperties,
  forwardRef,
  ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState
} from "react";
import useMergeRefs from "../../hooks/useMergeRefs";
import useKeyEvent from "../../hooks/useKeyEvent";
import { VirtualizedListItems } from "./VirtualizedListItems/VirtualizedListItems";
import { keyCodes, UP_DOWN_ARROWS } from "../../constants/keyCodes";
import { VibeComponent, withStaticProps, VibeComponentProps } from "../../types";
import { ListItemProps } from "../ListItem/ListItem";
import { ListTitleProps } from "../ListTitle/ListTitle";
import { ListWrapperComponentStringType, ListWrapperComponentType } from "./ListConstants";
import { ComponentDefaultTestId, getTestId } from "../../tests/test-ids-utils";
import { ListContext } from "./utils/ListContext";
import {
  getListItemComponentType,
  getListItemIdByIndex,
  getListItemIndexById,
  getNextListItemIndex,
  getPrevListItemIndex,
  useListId
} from "./utils/ListUtils";
import styles from "./List.module.scss";

export type ListProps = VibeComponentProps &
  AriaAttributes & {
    /**
     * the wrapping component to wrap the List Items [div, nav, ul, ol]
     */
    component?: ListWrapperComponentType | ListWrapperComponentStringType;
    /**
     * ARIA label string to describe to list
     */
    ariaLabel?: string;
    /**
     * ARIA described by string to reference an id to describe by
     */
    ariaDescribedBy?: string;
    children?: ReactElement<ListItemProps | ListTitleProps> | ReactElement<ListItemProps | ListTitleProps>[];
    /**
     * Using virtualized list for rendering only the items which visible to the user in any given user (performance optimization)
     */
    renderOnlyVisibleItems?: boolean;
    style?: CSSProperties;
  };

const List: VibeComponent<ListProps> & {
  components?: typeof ListWrapperComponentType;
} = forwardRef(
  (
    {
      className,
      id,
      component = List.components.UL,
      children,
      ariaLabel,
      ariaDescribedBy,
      renderOnlyVisibleItems = false,
      style,
      "data-testid": dataTestId,
      ref: _,
      ...restAriaAttributes
    },
    ref
  ) => {
    const overrideId = useListId(id);
    const componentRef = useRef(null);
    const [focusIndex, setFocusIndex] = useState(0);
    const mergedRef = useMergeRefs({ refs: [ref, componentRef] });
    const Component = component;
    const childrenRefs: React.MutableRefObject<HTMLElement[]> = useRef([]);

    const updateFocusedItem = useCallback((id: string) => {
      setFocusIndex(getListItemIndexById(childrenRefs, id));
      componentRef?.current?.setAttribute("aria-activedescendant", id);
    }, []);

    const onUpDownArrows = useCallback(
      (event: KeyboardEvent) => {
        if (renderOnlyVisibleItems) {
          return;
        }
        event.preventDefault();

        const isUpKey = event.key === keyCodes.UP_ARROW;
        const isDownKey = event.key === keyCodes.DOWN_ARROW;
        let overrideFocusIndex = undefined;

        if (isDownKey && focusIndex + 1 < childrenRefs.current.length) {
          overrideFocusIndex = getNextListItemIndex(focusIndex, childrenRefs);
        } else if (isUpKey && focusIndex > 0) {
          overrideFocusIndex = getPrevListItemIndex(focusIndex, childrenRefs);
        }
        if (overrideFocusIndex !== undefined) {
          updateFocusedItem(getListItemIdByIndex(childrenRefs, overrideFocusIndex));
          childrenRefs.current[overrideFocusIndex].focus();
        }
      },
      [focusIndex, renderOnlyVisibleItems, updateFocusedItem]
    );

    useKeyEvent({
      keys: UP_DOWN_ARROWS,
      callback: onUpDownArrows,
      ref: componentRef
    });

    const overrideChildren = useMemo(() => {
      let override: ReactElement | ReactElement[] = Array.isArray(children) ? children : [children];
      if (renderOnlyVisibleItems) {
        override = <VirtualizedListItems>{override}</VirtualizedListItems>;
      } else {
        childrenRefs.current = childrenRefs.current.slice(0, override.length);
        override = React.Children.map(override, (child, index) => {
          if (!React.isValidElement(child)) {
            return child;
          }

          const id = (child.props as { id: string }).id || `${overrideId}-item-${index}`;
          return React.cloneElement(child, {
            // @ts-ignore not sure how to deal with ref here
            ref: ref => (childrenRefs.current[index] = ref),
            tabIndex: focusIndex === index ? 0 : -1,
            id,
            component: getListItemComponentType(component)
          });
        });
      }

      return override;
    }, [children, component, focusIndex, overrideId, renderOnlyVisibleItems]);

    return (
      <ListContext.Provider value={{ updateFocusedItem }}>
        <Component
          data-testid={dataTestId || getTestId(ComponentDefaultTestId.LIST, id)}
          ref={mergedRef}
          style={style}
          className={cx(styles.list, className)}
          id={overrideId}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          role="listbox"
          {...restAriaAttributes}
        >
          {overrideChildren}
        </Component>
      </ListContext.Provider>
    );
  }
);

export default withStaticProps(List, {
  components: ListWrapperComponentType
});
