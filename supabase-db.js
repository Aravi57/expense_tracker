// Firestore-style data layer over Supabase.
// The app was written against Firestore's API (collection().where().onSnapshot(),
// add(), doc(id).update(), ...). This file provides that same small API on top of
// Supabase tables (see supabase/schema.sql), so the app code barely changes.
// Each record lives in a row's `data` column; the record's `userId` field maps to
// the row's `user_id` column, which row level security uses to keep users apart.

function createSupabaseDb(client) {
    const TABLES = {
        transactions: 'et_transactions',
        accounts: 'et_accounts',
        budgets: 'et_budgets',
        recurring: 'et_recurring',
        investments: 'et_investments'
    };

    const listeners = new Set();
    let realtimeChannel = null;

    function toDoc(row) {
        return {
            id: row.id,
            exists: true,
            data: () => ({ ...row.data, userId: row.user_id })
        };
    }

    function toSnapshot(rows) {
        const docs = rows.map(toDoc);
        return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
    }

    // userId is stored in the user_id column, not inside data
    function stripUserId(fields) {
        const { userId, ...rest } = fields;
        return rest;
    }

    async function currentUserId() {
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error('Not signed in');
        return data.session.user.id;
    }

    function check({ data, error }) {
        if (error) throw error;
        return data;
    }

    async function refresh(listener) {
        try {
            listener.onNext(await listener.query.get());
        } catch (error) {
            if (listener.onError) listener.onError(error);
            else console.error('Supabase listener error:', error);
        }
    }

    function notify(table) {
        listeners.forEach(l => { if (l.query.table === table) refresh(l); });
    }

    class Query {
        constructor(table, filters = [], order = null) {
            this.table = table;
            this.filters = filters;
            this.order = order;
        }

        where(field, op, value) {
            if (op !== '==') throw new Error(`Unsupported where operator: ${op}`);
            return new Query(this.table, [...this.filters, [field, value]], this.order);
        }

        orderBy(field, direction = 'asc') {
            return new Query(this.table, this.filters, [field, direction]);
        }

        async get() {
            let request = client.from(this.table).select('id, user_id, data').order('created_at', { ascending: true });
            for (const [field, value] of this.filters) {
                request = field === 'userId'
                    ? request.eq('user_id', value)
                    : request.eq(`data->>${field}`, String(value));
            }
            let rows = check(await request);
            if (this.order) {
                const [field, direction] = this.order;
                const sign = direction === 'desc' ? -1 : 1;
                rows = [...rows].sort((a, b) => ((a.data[field] || 0) - (b.data[field] || 0)) * sign);
            }
            return toSnapshot(rows);
        }

        onSnapshot(onNext, onError) {
            const listener = { query: this, onNext, onError };
            listeners.add(listener);
            refresh(listener);
            return () => listeners.delete(listener);
        }
    }

    class Collection extends Query {
        async add(fields) {
            const userId = await currentUserId();
            const row = check(await client.from(this.table)
                .insert({ user_id: userId, data: stripUserId(fields) })
                .select('id')
                .single());
            notify(this.table);
            return { id: row.id };
        }

        doc(id) {
            const table = this.table;
            return {
                id,
                async get() {
                    const row = check(await client.from(table).select('id, user_id, data').eq('id', id).maybeSingle());
                    return row ? toDoc(row) : { id, exists: false, data: () => undefined };
                },
                async update(fields) {
                    const row = check(await client.from(table).select('data').eq('id', id).single());
                    check(await client.from(table)
                        .update({ data: { ...row.data, ...stripUserId(fields) }, updated_at: new Date().toISOString() })
                        .eq('id', id));
                    notify(table);
                },
                async delete() {
                    check(await client.from(table).delete().eq('id', id));
                    notify(table);
                }
            };
        }
    }

    return {
        collection(name) {
            const table = TABLES[name];
            if (!table) throw new Error(`Unknown collection: ${name}`);
            return new Collection(table);
        },

        // Push changes made on other devices to the open listeners.
        startRealtime(userId) {
            this.stopRealtime();
            realtimeChannel = client.channel('expense-tracker-' + userId);
            Object.values(TABLES).forEach(table => {
                ['INSERT', 'UPDATE'].forEach(event => {
                    realtimeChannel.on('postgres_changes',
                        { event, schema: 'public', table, filter: `user_id=eq.${userId}` },
                        () => notify(table));
                });
                // Delete events can't be filtered by user; they carry only the row id, so just re-query.
                realtimeChannel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => notify(table));
            });
            realtimeChannel.subscribe();
        },

        stopRealtime() {
            if (realtimeChannel) client.removeChannel(realtimeChannel);
            realtimeChannel = null;
        },

        // Drop all listeners, e.g. on logout.
        reset() {
            listeners.clear();
            this.stopRealtime();
        }
    };
}
