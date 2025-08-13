import * as React from 'react';

import { MemoryRouter } from 'react-router-dom';
import { render } from '../../../test-utils/testing-library';
import {
    SIDEBAR_FORCE_KEY,
    SIDEBAR_FORCE_VALUE_CLOSED,
    SIDEBAR_FORCE_VALUE_OPEN,
    SIDEBAR_SELECTED_PANEL_KEY,
    SidebarComponent as Sidebar,
} from '../Sidebar';
import SidebarNav from '../SidebarNav';
import SidebarPanels from '../SidebarPanels';
import LocalStore from '../../../utils/LocalStore';

jest.mock('../SidebarNav', () => ({
    __esModule: true,
    default: jest.fn(() => 'SidebarNav'),
}));
jest.mock('../SidebarPanels', () => ({
    __esModule: true,
    default: jest.fn(() => 'SidebarPanels'),
}));
jest.mock('../../common/async-load', () => () => 'LoadableComponent');
jest.mock('../../../utils/LocalStore');

describe('elements/content-sidebar/Sidebar', () => {
    const file = {
        id: 'id',
        file_version: {
            id: '123',
        },
    };

    const withDocgenFeature = {
        enabled: true,
        checkDocGenTemplate: jest.fn(),
        isDocGenTemplate: false,
    };

    const withOutDocgenFeature = {
        enabled: false,
        checkDocGenTemplate: jest.fn(),
        isDocGenTemplate: false,
    };

    const defaultProps = {
        file,
        location: { pathname: '/' },
        docGenSidebarProps: withOutDocgenFeature,
    };


    const getSidebar = props => (
        <MemoryRouter initialEntries={['/']}>
            <Sidebar {...defaultProps} {...props} />
        </MemoryRouter>
    );

    const renderSidebar = props => render(getSidebar(props));

    // LocalStore mock setup
    const mockGetItem = jest.fn();
    const mockSetItem = jest.fn();

    beforeEach(() => {
        jest.resetAllMocks();
        // Re-establish LocalStore mock implementation after reset
        LocalStore.mockImplementation(() => ({
            getItem: mockGetItem,
            setItem: mockSetItem,
        }));
    });

    describe('componentDidMount', () => {
        test('should call checkDocGenTemplate if docgen is enabled', () => {
            renderSidebar({
                docGenSidebarProps: withDocgenFeature,
                metadataSidebarProps: { isFeatureEnabled: true },
            });

            expect(withDocgenFeature.checkDocGenTemplate).toHaveBeenCalledTimes(1);
        });

        test.each`
            localStoreValue | expected
            ${'closed'}     | ${false}
            ${'open'}       | ${true}
            ${null}         | ${true}
        `(
            'given the LocalStore value for open state = localStoreValue, should call onOpenChange with $expected and "initialState" parameter = true',
            ({ localStoreValue, expected }) => {
                const mockOnOpenChange = jest.fn();
                mockGetItem.mockReturnValue(localStoreValue);

                renderSidebar({
                    onOpenChange: mockOnOpenChange,
                });
                expect(mockOnOpenChange).toBeCalledWith(expected, true);
            },
        );
    });

    describe('componentDidUpdate', () => {

        test('should update if a user-initiated location change occurred', () => {
            const { rerender } = renderSidebar({ 
                location: { pathname: '/activity', state: { open: false } } 
            });

            // LocalStore should be called during constructor for initial location state
            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, SIDEBAR_FORCE_VALUE_CLOSED);
            mockSetItem.mockClear();

            rerender(getSidebar({ 
                location: { pathname: '/details', state: { open: true } } 
            }));

            // Should call LocalStore setItem again in componentDidUpdate when location changes with new open state
            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, SIDEBAR_FORCE_VALUE_OPEN);
        });

        test('should not set isDirty if an app-initiated location change occurred', () => {
            const mockHistoryReplace = jest.fn();
            const { rerender } = renderSidebar({ 
                location: { pathname: '/activity' },
                history: { replace: mockHistoryReplace },
                fileId: 'file1',
            });

            // Simulate app-initiated location change (silent: true)
            rerender(getSidebar({ 
                location: { pathname: '/details', state: { silent: true } },
                history: { replace: mockHistoryReplace },
                fileId: 'file1',
            }));

            // Now change fileId - since isDirty should still be false, history.replace should be called
            rerender(getSidebar({ 
                location: { pathname: '/details', state: { silent: true } },
                history: { replace: mockHistoryReplace },
                fileId: 'file2',
            }));

            // Should call history.replace because isDirty remained false (app-initiated change)
            expect(mockHistoryReplace).toHaveBeenCalledWith({ pathname: '/', state: { silent: true } });
        });

        test('should set isDirty to true if a user-initiated location change occurred', () => {
            const mockHistoryReplace = jest.fn();
            const { rerender } = renderSidebar({ 
                location: { pathname: '/activity' },
                history: { replace: mockHistoryReplace },
                fileId: 'file1',
            });

            // Simulate user-initiated location change (no silent flag)
            rerender(getSidebar({ 
                location: { pathname: '/details' },
                history: { replace: mockHistoryReplace },
                fileId: 'file1',
            }));

            // Now change fileId - since isDirty should be true, history.replace should NOT be called
            rerender(getSidebar({ 
                location: { pathname: '/details' },
                history: { replace: mockHistoryReplace },
                fileId: 'file2',
            }));

            // Should NOT call history.replace because isDirty was set to true (user-initiated change)
            expect(mockHistoryReplace).not.toHaveBeenCalled();
        });

        test('should set the forced open state if the location state is present', () => {
            const { rerender } = renderSidebar({ 
                location: { pathname: '/' } 
            });


            // Location change without open state - should not set forced state  
            rerender(getSidebar({ 
                location: { pathname: '/details' } 
            }));
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).not.toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, expect.anything());

            // Location change with open: true (without silent) - should set forced open
            mockSetItem.mockClear();
            mockGetItem.mockClear();
            rerender(getSidebar({ 
                location: { pathname: '/details/inner', state: { open: true } } 
            }));
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, SIDEBAR_FORCE_VALUE_OPEN);

            mockSetItem.mockClear();
            mockGetItem.mockClear();

            // Location change with open: false - should set forced closed
            rerender(getSidebar({ 
                location: { pathname: '/activity', state: { open: false } } 
            }));
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, SIDEBAR_FORCE_VALUE_CLOSED);

            mockSetItem.mockClear();
            mockGetItem.mockClear();

            // Location change with silent: true should NOT trigger setForcedByLocation
            rerender(getSidebar({ 
                location: { pathname: '/metadata', state: { open: true, silent: true } } 
            }));
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).not.toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, expect.anything());
        });
        test('should re-check whether a file is docgen template on file change', () => {
            // left defaults to indicate the difference with rerender
            const { rerender } = renderSidebar({
                file,
                location: { pathname: '/' },
                docGenSidebarProps: withDocgenFeature,
                metadataSidebarProps: { isFeatureEnabled: true },
            });

            expect(withDocgenFeature.checkDocGenTemplate).toHaveBeenCalledTimes(1);

            rerender(getSidebar({
                file: { ...file, id: 'new-file' },
                location: { pathname: '/' },
                docGenSidebarProps: withDocgenFeature,
                metadataSidebarProps: { isFeatureEnabled: true },
            }));

            expect(withDocgenFeature.checkDocGenTemplate).toHaveBeenCalledTimes(2);
        });
        test('should redirect to docgen tab if the new file is a docgen template', () => {
            const historyMock = {
                push: jest.fn(),
                location: {
                    pathname: '/activity/comments/1234',
                },
            };

            const { rerender } = renderSidebar({
                location: { pathname: '/' },
                file,
                history: historyMock,
                docGenSidebarProps: withDocgenFeature,
                metadataSidebarProps: { isFeatureEnabled: true },
            });

            // Change file and set isDocGenTemplate to true to trigger redirect
            rerender(getSidebar({
                location: { pathname: '/' },
                file: { ...file, id: 'new-file' },
                history: historyMock,
                docGenSidebarProps: {
                    ...withDocgenFeature,
                    isDocGenTemplate: true,
                },
                metadataSidebarProps: { isFeatureEnabled: true },
            }));

            expect(historyMock.push).toHaveBeenCalledWith('/docgen');
        });
        test('should redirect to default route if new file is not a docgen template', () => {
            const historyMock = {
                push: jest.fn(),
                location: {
                    pathname: '/activity/comments/1234',
                },
            };

            const { rerender } = renderSidebar({
                location: { pathname: '/docgen' },
                file,
                history: historyMock,
                docGenSidebarProps: {
                    ...withDocgenFeature,
                    isDocGenTemplate: true,
                },
                metadataSidebarProps: { isFeatureEnabled: true },
            });

            // Change file to one that is NOT a docgen template
            rerender(getSidebar({
                location: { pathname: '/docgen' },
                file: { ...file, id: 'new-file' },
                history: historyMock,
                docGenSidebarProps: withDocgenFeature, // No isDocGenTemplate: true
                metadataSidebarProps: { isFeatureEnabled: true },
            }));

            expect(historyMock.push).toHaveBeenCalledWith('/');
        });
        describe('open state change', () => {
            const mockOnOpenChange = jest.fn();

            afterEach(() => {
                mockOnOpenChange.mockClear();
            });

            test.each`
                prevOpen     | open
                ${false}     | ${true}
                ${true}      | ${false}
                ${undefined} | ${true}
                ${undefined} | ${false}
            `(
                'given previous open state = $prevOpen and new open state = $open should call onOpenChange with $open',
                ({ prevOpen, open }) => {
                    const { rerender } = renderSidebar({
                        location: {
                            pathname: '/',
                            state: { open: prevOpen },
                        },
                    });

                    rerender(
                        getSidebar({
                            location: {
                                pathname: '/',
                                state: { open },
                            },
                            onOpenChange: mockOnOpenChange,
                        }),
                    );

                    expect(mockOnOpenChange).toBeCalledWith(open, false);
                },
            );
            test.each`
                prevOpen | open
                ${false} | ${false}
                ${true}  | ${true}
            `(
                'given previous open state = $prevOpen and new open state = $open should not call onOpenChange',
                ({ prevOpen, open }) => {
                    const { rerender } = renderSidebar({
                        location: {
                            pathname: '/',
                            state: { open: prevOpen },
                        },
                    });

                    rerender(
                        getSidebar({
                            location: {
                                pathname: '/',
                                state: { open },
                            },
                            onOpenChange: mockOnOpenChange,
                        }),
                    );

                    expect(mockOnOpenChange).not.toBeCalled();
                },
            );
        });
    });

    describe('handleVersionHistoryClick', () => {
        test('should handle url with deeplink', () => {
            const historyMock = {
                push: jest.fn(),
                location: {
                    pathname: '/activity/comments/1234',
                },
            };

            const preventDefaultMock = jest.fn();
            const event = {
                preventDefault: preventDefaultMock,
            };

            // Create a ref to capture the Sidebar instance
            let sidebarInstance = null;
            const getSidebarWithRef = props => (
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar 
                        {...defaultProps} 
                        {...props} 
                        ref={ref => { sidebarInstance = ref; }} 
                    />
                </MemoryRouter>
            );

            render(getSidebarWithRef({ 
                history: historyMock, 
                file: { id: '1234', file_version: { id: '4567' } }
            }));

            // Test the handleVersionHistoryClick method
            sidebarInstance.handleVersionHistoryClick(event);

            expect(preventDefaultMock).toHaveBeenCalled();
            expect(historyMock.push).toHaveBeenCalledWith('/activity/versions/4567');
        });

        test('should handle url without deeplink', () => {
            const historyMock = {
                push: jest.fn(),
                location: {
                    pathname: '/details',
                },
            };

            const preventDefaultMock = jest.fn();
            const event = {
                preventDefault: preventDefaultMock,
            };

            // Create a ref to capture the Sidebar instance
            let sidebarInstance = null;
            const getSidebarWithRef = props => (
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar 
                        {...defaultProps} 
                        {...props} 
                        ref={ref => { sidebarInstance = ref; }} 
                    />
                </MemoryRouter>
            );

            render(getSidebarWithRef({ 
                history: historyMock, 
                file: { id: '1234', file_version: { id: '4567' } }
            }));

            // Test the handleVersionHistoryClick method
            sidebarInstance.handleVersionHistoryClick(event);

            expect(preventDefaultMock).toHaveBeenCalled();
            expect(historyMock.push).toHaveBeenCalledWith('/details/versions/4567');
        });
    });

    describe('isForced', () => {
        test('returns the current value from the localStore', () => {
            mockGetItem.mockReturnValue(SIDEBAR_FORCE_VALUE_OPEN);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            const { getByTestId } = renderSidebar({
                isDefaultOpen: false,
            });

            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).not.toHaveBeenCalled();
            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('true');
            
        });

        test('returns an empty value from localStore if the value is unset', () => {
            mockGetItem.mockReturnValue(null);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            const { getByTestId } = renderSidebar({
                isDefaultOpen: true,
            });

            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            expect(mockSetItem).not.toHaveBeenCalled();
            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('true');
        });

        test('sets and then returns the value to localStore if passed in', () => {
            mockGetItem.mockReturnValue(null);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            let sidebarInstance = null;
            const getSidebarWithRef = props => (
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar 
                        {...defaultProps} 
                        {...props} 
                        ref={ref => { sidebarInstance = ref; }} 
                    />
                </MemoryRouter>
            );

            const { getByTestId } = render(getSidebarWithRef({
                isDefaultOpen: false,
            }));

            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('false');

            mockSetItem.mockClear();
            mockGetItem.mockClear();

            mockGetItem.mockReturnValue(SIDEBAR_FORCE_VALUE_OPEN);

            const result = sidebarInstance.isForced(true);

            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY, SIDEBAR_FORCE_VALUE_OPEN);
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
            
            // Verify the return value of isForced()
            expect(result).toEqual(SIDEBAR_FORCE_VALUE_OPEN);
        });
    });

    describe('isForcedSet', () => {
        test('should return true if the value is not null - forced open', () => {
            mockGetItem.mockReturnValue(SIDEBAR_FORCE_VALUE_OPEN);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            const { getByTestId } = renderSidebar({
                isDefaultOpen: false,
            });

            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('true');
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
        });

        test('should return true if the value is not null - forced closed', () => {
            mockGetItem.mockReturnValue(SIDEBAR_FORCE_VALUE_CLOSED);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            const { getByTestId } = renderSidebar({
                isDefaultOpen: true,
            });

            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('false');
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
        });

        test('should return false if the value is null', () => {
            mockGetItem.mockReturnValue(null);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);

            const { getByTestId } = renderSidebar({
                isDefaultOpen: true,
            });

            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('true');
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
        });

        test('should return false if the value is null - fallback to false', () => {
            mockGetItem.mockReturnValue(null);

            const MockSidebarPanels = jest.fn(({ isOpen }) => (
                <div data-testid="sidebar-panels-isopen">{isOpen.toString()}</div>
            ));
            SidebarPanels.mockImplementation(MockSidebarPanels);
            
            const { getByTestId } = renderSidebar({
                isDefaultOpen: false,
            });

            expect(getByTestId('sidebar-panels-isopen')).toHaveTextContent('false');
            expect(mockGetItem).toHaveBeenCalledWith(SIDEBAR_FORCE_KEY);
        });
    });

    describe('render', () => {
        test.each`
            forced                        | isDefaultOpen | expected
            ${SIDEBAR_FORCE_VALUE_CLOSED} | ${true}       | ${false}
            ${SIDEBAR_FORCE_VALUE_CLOSED} | ${false}      | ${false}
            ${SIDEBAR_FORCE_VALUE_OPEN}   | ${true}       | ${true}
            ${SIDEBAR_FORCE_VALUE_OPEN}   | ${false}      | ${true}
            ${null}                       | ${true}       | ${true}
            ${null}                       | ${false}      | ${false}
        `(
            'should render the open state correctly with forced set to $forced and isDefaultOpen set to $isDefaultOpen',
            ({ expected, forced, isDefaultOpen }) => {
                mockGetItem.mockReturnValue(forced);
                const { container } = renderSidebar({ isDefaultOpen });
                expect(container.firstChild.classList.contains('bcs-is-open')).toBe(expected);
            },
        );

        test('should not render SidebarNav when hasNav is false', () => {
            const { queryByText } = renderSidebar({ hasNav: false });
            expect(queryByText('SidebarNav')).toBeNull();
        });

        describe('SidebarPanels', () => {
            const MockSidebarPanels = jest.fn(() => 'SidebarPanels');

            beforeEach(() => {
                SidebarPanels.mockImplementationOnce(MockSidebarPanels);
            });


            test.each`
                panelSelectionPreservation | savedDefaultPanel | expected
                ${true}                    | ${'activity'}     | ${'activity'}
                ${true}                    | ${'details'}      | ${'details'}
                ${true}                    | ${null}           | ${undefined}
                ${false}                   | ${'activity'}     | ${undefined}
                ${undefined}               | ${'activity'}     | ${undefined}
            `(
                'should render SidebarPanels with defaultPanel prop = $defaultPanel, given sidebar selected panel saved in LocalStore is $defaultPanel and panelSelectionPreservation feature = $panelSelectionPreservation',
                ({ panelSelectionPreservation, savedDefaultPanel, expected }) => {
                    mockGetItem.mockReturnValue(savedDefaultPanel);
                    renderSidebar({
                        features: { panelSelectionPreservation },
                    });
                    expect(MockSidebarPanels).toHaveBeenCalledWith(
                        expect.objectContaining({ defaultPanel: expected }),
                        {},
                    );
                },
            );
        });
    });

    describe('refresh()', () => {
        test.each([true, false])('should call panel refresh with the provided boolean', shouldRefreshCache => {
            let sidebarInstance = null;
            const getSidebarWithRef = props => (
                <MemoryRouter initialEntries={['/']}>
                    <Sidebar 
                        {...defaultProps} 
                        {...props} 
                        ref={ref => { sidebarInstance = ref; }} 
                    />
                </MemoryRouter>
            );

            render(getSidebarWithRef());

            const mockRefresh = jest.fn();
            sidebarInstance.sidebarPanels = { current: { refresh: mockRefresh } };
            sidebarInstance.refresh(shouldRefreshCache);
            expect(mockRefresh).toHaveBeenCalledWith(shouldRefreshCache);
        });
    });

    describe('on panel change', () => {
        const mockPanelName = 'activity';

        beforeEach(() => {
            SidebarNav.mockImplementationOnce(({ onPanelChange }) => {
                onPanelChange(mockPanelName, false);
                return 'SidebarNav';
            });
        });

        test('should call onPanelChange prop when handling panel change by the user', () => {
            const mockOnPanelChange = jest.fn();
            renderSidebar({
                hasNav: true,
                onPanelChange: mockOnPanelChange,
            });

            expect(mockOnPanelChange).toHaveBeenCalledWith(mockPanelName, false);
        });

        test('should call onPanelChange prop when handling setting of initial panel', () => {
            SidebarPanels.mockImplementationOnce(({ onPanelChange }) => {
                onPanelChange(mockPanelName, true);
                return 'SidebarPanels';
            });
            const mockOnPanelChange = jest.fn();
            renderSidebar({
                onPanelChange: mockOnPanelChange,
            });

            expect(mockOnPanelChange).toHaveBeenCalledWith(mockPanelName, true);
        });

        test('given panelSelectionPreservation feature = true should save panel name in LocalStore', () => {
            renderSidebar({
                features: { panelSelectionPreservation: true },
                hasNav: true,
            });

            expect(mockSetItem).toHaveBeenCalledWith(SIDEBAR_SELECTED_PANEL_KEY, mockPanelName);
        });

        test.each`
            panelSelectionPreservation
            ${undefined}
            ${false}
        `(
            'given panelSelectionPreservation feature = $panelSelectionPreservation should not save panel name in LocalStore',
            ({ panelSelectionPreservation }) => {
                renderSidebar({
                    features: { panelSelectionPreservation },
                    hasNav: true,
                });

                expect(mockSetItem).not.toHaveBeenCalled();
            },
        );
    });
});
