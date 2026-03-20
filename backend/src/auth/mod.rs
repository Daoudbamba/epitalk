//! Authentication and authorization module
//!
//! Provides JWT-based authentication, password hashing, and RBAC middleware.

pub mod jwt;
mod middleware;
mod password;

pub use jwt::{Claims, JwtService};
pub use middleware::RequireAuth;
pub use password::PasswordService;
