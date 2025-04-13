# METAGRAPH Active Context

## Current Work Focus

The current focus is on implementing a URL-based network navigation structure to resolve race conditions during network switching, while continuing to improve API method pages, application architecture, and wallet integration. We're also enhancing the Alkanes explorers, ensuring proper SDK integration, and improving overall user experience.

## Recent Changes

### 1. Explorer Pages Improvements and Issues

We've been working on fixing issues with the `/explorer/2:n` pages, particularly focusing on pagination and filtering:

- Updated the "Show unverified WASM contracts" checkbox:
  - Changed the default state to `false` to initially filter out unverified WASM contracts
  - Applied proper 98.css styling to the checkbox using the `field-row` and `checkbox` classes
  - Implemented filtering logic to hide tokens with blank names by default

- Attempted to fix pagination controls:
  - Implemented a `hasMore` flag in the `useTokensWithCache` hook to determine if there are more pages
  - Updated the Next button to use this flag instead of complex conditions
  - Improved the caching strategy to use URL-friendly cache keys that match the page structure
  - Enhanced the `getAllAlkanes` function to provide better pagination information

- Encountered issues that still need resolution:
  - The filtering functionality is not working correctly - toggling the checkbox to show unverified contracts doesn't display all missing tokens
  - Results are being cut short for all tokens, affecting pagination
  - Need to investigate if we should fetch all tokens first and then handle pagination client-side

### 2. Network Navigation Architectural Analysis

We've analyzed a critical race condition issue with the current network switching mechanism:
- When users rapidly switch between networks (e.g., from mainnet to oylnet and back quickly), multiple asynchronous data fetching operations run concurrently
- Later network responses can override earlier ones, causing UI inconsistency (e.g., UI shows oylnet but displays mainnet data)
- This creates confusion for users and undermines the reliability of the explorer

We've created a comprehensive plan to address this through URL-based network state:
- Created a detailed feature request documenting the URL-based navigation structure
- Developed an implementation plan outlining all necessary components and changes
- Proposed a migration strategy to maintain backward compatibility
- Prepared code examples for key components like NetworkProvider and NetworkNav

### 2. AlkanesBalanceExplorer Implementation

We've implemented a comprehensive Alkanes Balance Explorer that allows users to view their token balances with visual representation:

- Created `AlkanesBalanceExplorer.jsx` page component for exploring Alkanes token balances by address
- Enhanced the `getAlkanesByAddress` function to transform complex API responses into a user-friendly format
- Implemented `getAlkanesTokenImage` function to retrieve token images using the simulate method
- Added `hexToDataUri` utility to convert hex string image data to displayable data URIs
- Created a responsive table layout with token images, names, symbols, IDs, and balances
- Added copy functionality for token IDs and addresses
- Implemented wallet integration to allow users to view their own token balances
- Added loading states and error handling for token image retrieval
- Ensured proper formatting of token IDs for better readability

This implementation demonstrates the power of the Oyl SDK's simulation capabilities for retrieving token metadata beyond basic balance information.

### 3. LaserEyes Wallet Integration

We've integrated the LaserEyes package to provide Bitcoin wallet functionality:

- Modified `App.jsx` to wrap the application with `LaserEyesProvider` and ensure client-side only rendering
- Created a `WalletConnector.jsx` component that displays a list of supported wallets
- Implemented a network mapping utility to align LaserEyes network types with METAGRAPH network environments
- Created an example component demonstrating how to use LaserEyes functionality in other components
- Ensured the wallet connection UI follows the design guidelines

The integration allows users to connect various Bitcoin wallets (Unisat, Leather, Magic Eden, etc.) and provides access to wallet functionality throughout the application.

### 4. Trace Method Implementation

We've implemented a dedicated page for the "trace" API method that visualizes and allows testing of transaction execution traces:

- Updated `src/sdk/alkanes.js` to correctly implement the `traceTransaction` function using the AlkanesRpc trace method
- Created a dedicated `TraceForm.jsx` component for the trace method page
- Enhanced the `APIForm.jsx` component to support examples and notes sections
- Added proper routing for the trace method page
- Implemented the UI according to the design specifications

### 5. Application Architecture Improvements

We've improved the application architecture to better use React Router and create a more consistent user experience:

- Updated `main.jsx` to use React Router with the RouterProvider
- Modified `App.jsx` to use React Router's Outlet component and serve as the root layout
- Updated `Home.jsx` to match the design from App.jsx while using proper React Router links
- Updated `routes.jsx` to use App.jsx as the root layout component
- Ensured proper context passing between components

### 6. Node.js Compatibility Layer Implementation

We've implemented a comprehensive Node.js compatibility layer to allow the Oyl SDK (which was designed for Node.js) to run in a browser environment:

- Created `src/sdk/node-shims.js` to provide browser-compatible implementations of Node.js-specific features
- Added shims for:
  - `process` object with properties like `version`, `cwd()`, and `env`
  - `fs` module with basic file system operations
  - `path` module with path manipulation utilities
  - `global` object
  - `Buffer` implementation

This approach allows us to use the Oyl SDK without modifying its source code, making future updates easier.

### 7. Provider Implementation Improvements

We've enhanced the provider implementation to handle errors more gracefully and avoid using mock data:

- Updated `src/sdk/provider.js` to import Node.js shims before any other imports
- Implemented a proxy for the sandshrew client to handle missing methods
- Removed fallback to mock data in error cases
- Added proper error handling and logging
- Implemented real health check and block height methods

### 8. Alkanes API Methods Implementation

We've updated the Alkanes API methods to use real data and handle errors properly:

- Updated `src/sdk/alkanes.js` to import Node.js shims
- Added validation to ensure required methods exist before calling them
- Implemented proper error handling for all methods
- Removed mock data fallbacks
- Added comprehensive logging for debugging

### 9. Error Handling Improvements

We've implemented a more robust error handling strategy:

- Added retry mechanism in the BlockHeight component
- Improved error messages to be more user-friendly
- Added detailed logging for debugging
- Ensured errors are properly propagated to the UI

## Active Decisions and Considerations

### 1. URL-based Network State Approach

We've decided to implement a URL-based network state approach to address the race condition issue:

- URLs will follow a `/[provider]/[metaprotocol]/[resource-type]/[specific-resource]` pattern
- Network switching will be handled through navigation rather than state changes
- This approach eliminates race conditions by making each page load specific to a single network
- It enhances link sharing, documentation, and caching capabilities
- Components will get network information from URL parameters rather than context

Benefits of this approach:
- Eliminates race conditions entirely
- Makes URLs shareable and bookmarkable
- Improves caching capabilities
- Enhances documentation with specific network links
- Creates a clearer mental model (one page = one network = one data source)

Implementation considerations:
- Need to maintain backward compatibility during transition
- Some components will need to be updated to handle network parameters from both context and URL
- Navigation component needs to preserve current path when switching networks
- SDK functions need to support AbortController for proper request cancellation

### 2. Token Image Retrieval Approach

We've adopted a specific approach for retrieving and displaying token images:

- Using the simulate method with input value 1000 to retrieve token images
- Converting hex string responses to data URIs for direct display in the browser
- Implementing a caching mechanism to avoid redundant image requests
- Adding placeholder images for tokens without images
- Implementing loading states to provide feedback during image retrieval
- Using error handling to gracefully handle failed image retrievals
- Optimizing image display with proper sizing and formatting

This approach leverages the Oyl SDK's simulation capabilities to retrieve rich token metadata beyond what's available in basic balance queries.

### 3. Wallet Integration Approach

We've adopted a specific approach for wallet integration:

- Using LaserEyes package for wallet connectivity rather than implementing our own solution
- Implementing a wallet selection UI that shows all available wallet options
- Focusing on connection functionality first, with display of wallet information to be handled in specific components as needed
- Ensuring the wallet provider is only rendered on the client-side to prevent server-side rendering issues
- Using network mapping to align LaserEyes network types with METAGRAPH network environments

### 4. Component Structure and Reusability

We've adopted a component structure that promotes reusability:

- Created a template component (`APIForm.jsx`) that can be reused for all API methods
- Implemented method-specific components that use the template component
- Created a reusable `WalletConnector` component for wallet functionality
- Ensured consistent styling and behavior across all components

### 5. Routing Architecture

We've implemented a routing architecture that:

- Uses App.jsx as the root layout component
- Passes the endpoint context to child routes
- Ensures proper route matching for API method pages
- Provides a consistent user experience across the application

With our planned URL-based network approach, this will be enhanced to:
- Include network in URL parameters
- Create a dedicated NetworkProvider component
- Switch from toggle-based to navigation-based network selection
- Maintain both routing patterns during transition

### 6. Browser Compatibility Approach

We decided to implement custom Node.js shims rather than modifying the Oyl SDK or using a different library. This decision was made because:

- It allows us to use the official Oyl SDK without modifications
- It provides more control over the compatibility layer
- It's more maintainable as the SDK evolves
- It's a cleaner solution than trying to modify the SDK

### 7. Error Handling Strategy

We decided to handle errors at multiple levels:

- SDK level: Catch and log errors, return structured error responses
- Component level: Display user-friendly error messages, implement retry mechanisms
- Application level: Prevent crashes with error boundaries

This multi-layered approach ensures that errors are handled appropriately at each level of the application.

### 8. Network Configuration

We're supporting three network environments:

- Mainnet: For production use with real Bitcoin
- Regtest: For local development and testing
- Oylnet: For testing with a more stable testnet

Each environment has its own configuration and can be selected at runtime.

### 9. Performance Considerations

We're implementing several strategies to address performance concerns:

- Limiting the number of transactions processed in block tracing
- Adding validation before making API calls
- Implementing retry mechanisms with backoff
- Providing clear feedback during long-running operations
- Ensuring the LaserEyesProvider is only rendered on the client-side
- Adding request cancellation with AbortController to prevent race conditions

## Next Steps

### 1. Implement URL-based Network Navigation

- Create NetworkProvider and NetworkNav components
- Update routes.jsx with new URL structure
- Adapt existing Alkanes explorer pages to use network from URL
- Enhance SDK functions with AbortController support
- Add redirect logic from old URLs to new structure
- Test across all networks and verify race condition is resolved

### 2. Enhance Wallet Integration

- Add more wallet-specific functionality
- Implement transaction history display
- Add balance display in appropriate components
- Improve error handling for wallet connection failures
- Test with various wallet providers

### 3. Implement Additional API Methods

- Implement remaining API methods from the method matrix
- Ensure consistent design and behavior across all method pages
- Add comprehensive documentation for each method

### 4. Enhance User Experience

- Improve navigation between method pages
- Add more interactive examples
- Implement better error handling and feedback
- Add pagination for methods that return large datasets

### 5. Complete Integration Testing

- Test all API methods with real data
- Verify error handling works as expected
- Test performance with large datasets
- Test across different network environments
- Test wallet functionality with different wallet providers

### 6. UI Improvements

- Enhance loading states for better user experience
- Improve error message display
- Add more contextual help for users
- Implement responsive design improvements

### 7. Documentation Updates

- Update API method documentation with real examples
- Add troubleshooting guides for common errors
- Document the integration approach for other developers
- Create tutorials for common use cases
- Document wallet integration and usage

### 8. Additional Features

- Implement caching for frequently accessed data
- Add export functionality for API responses
- Implement search functionality for method pages
- Add user preferences for default network and other settings

## Key Insights

1. **Network State Management**: The race condition issue with network switching demonstrates the importance of treating network selection as a navigation event rather than a state change, ensuring data consistency and eliminating race conditions.

2. **Wallet Integration**: The LaserEyes package provides a clean way to integrate with various Bitcoin wallets without having to implement wallet-specific code. The package handles the detection of available wallets and provides a consistent interface for interacting with them.

3. **React Router Integration**: Properly integrating React Router is crucial for a consistent user experience. Using the Outlet component and context passing ensures that components have access to the data they need.

4. **Component Reusability**: Creating reusable components like APIForm and WalletConnector has significantly reduced code duplication and ensured consistency across the application.

5. **Node.js to Browser Compatibility**: The most significant challenge has been making the Node.js-based Oyl SDK work in a browser environment. Our shims approach has proven effective but requires careful testing.

6. **Real vs. Mock Data**: Removing mock data has revealed several edge cases and error scenarios that weren't previously handled. This has led to more robust error handling throughout the application.

7. **API Reliability**: Different network environments have different reliability characteristics. Mainnet is more stable but slower, while regtest is faster but requires local setup.

8. **Developer Experience**: The application needs to provide clear feedback and guidance to developers, especially when errors occur. This includes both UI feedback and detailed logging.

9. **Performance Tradeoffs**: There's a balance between providing comprehensive data and maintaining good performance. We're implementing strategies like pagination and limiting dataset size to address this.

10. **Request Cancellation**: Properly canceling in-flight requests when components unmount or network changes is critical for preventing race conditions and memory leaks.

This active context document captures the current state of the METAGRAPH project, focusing on the recent implementation work and the decisions and considerations that are guiding this work.
