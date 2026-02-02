//! Authentication and authorization module
//!
//! Provides JWT-based authentication, password hashing, and RBAC middleware.

mod jwt;
mod middleware;
mod password;

pub use jwt::{Claims, JwtService};
pub use middleware::{AuthUser, RequireAuth, RequireRole};
pub use password::PasswordService;
