"""007_create_tags_and_note_tags_tables — Tạo bảng tags canonical và note_tags liên kết (Batch C38 Lô 2 Phương án B).

Revision ID: 007
Revises: 006
Create Date: 2026-11-20 11:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Bảng tags (canonical slug & display label)
    op.create_table(
        'tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('canonical_slug', sa.String(length=50), nullable=False),
        sa.Column('display_label', sa.String(length=100), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text("TIMEZONE('utc', NOW())"),
            nullable=False,
        ),
    )
    op.create_index('ix_tags_canonical_slug', 'tags', ['canonical_slug'], unique=True)

    # 2. Bảng note_tags (association note_id <-> tag_id)
    op.create_table(
        'note_tags',
        sa.Column(
            'note_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('research_notes.id', ondelete='CASCADE'),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            'tag_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tags.id', ondelete='CASCADE'),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text("TIMEZONE('utc', NOW())"),
            nullable=False,
        ),
        sa.UniqueConstraint('note_id', 'tag_id', name='uq_note_tags_note_tag'),
    )
    op.create_index('ix_note_tags_note_id', 'note_tags', ['note_id'])
    op.create_index('ix_note_tags_tag_id', 'note_tags', ['tag_id'])


def downgrade() -> None:
    op.drop_table('note_tags')
    op.drop_table('tags')
