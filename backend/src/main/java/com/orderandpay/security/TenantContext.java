package com.orderandpay.security;

import java.util.UUID;

/** Stocke le restaurantId du tenant courant par thread. */
public final class TenantContext {

    private static final ThreadLocal<UUID> TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static void setCurrentTenant(UUID id) { TENANT.set(id); }
    public static UUID  getCurrentTenant()        { return TENANT.get(); }
    public static void  clear()                   { TENANT.remove(); }
}
