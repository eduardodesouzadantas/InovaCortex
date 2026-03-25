export {
    AUTH_RATE_LIMIT_WINDOW_MS as AUTH_LOGIN_WINDOW_MS,
    AUTH_LOGIN_IDENTIFIER_LIMIT,
    AUTH_LOGIN_IP_LIMIT,
    clearAuthRateLimitState as clearAuthLoginRateLimitState,
    consumeAuthLoginRateLimit,
    resolveAuthLoginClientIp,
    type AuthRateLimitDecision as AuthLoginRateLimitDecision,
} from "@/lib/auth/auth-rate-limit";
