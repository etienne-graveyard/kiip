# Kiip server

> Server for Kiip

```sql
CREATE TABLE public.documents (
    id character varying(100) NOT NULL,
    title character varying(300) NOT NULL,
    clock character varying(100) NOT NULL,
    merkle text NOT NULL
);

CREATE TABLE public.users (
    email character varying(100) NOT NULL,
    token character varying(100) NOT NULL
);

CREATE TABLE public.access (
    user_email character varying(100) NOT NULL,
    document_id character varying(100) NOT NULL,
    access character varying(50) NOT NULL
);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (email);

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.access
    ADD CONSTRAINT access_pkey PRIMARY KEY (user_email, document_id);

ALTER TABLE ONLY public.access
    ADD CONSTRAINT document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.access
    ADD CONSTRAINT user_email_fkey FOREIGN KEY (user_email) REFERENCES public.users(email) ON DELETE CASCADE;
```
