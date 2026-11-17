"""llm_key_selected_model

Store the model a user picked for each API key (model dropdown).

Revision ID: b7c4e2a91f3d
Revises: e9cdd61b7f2f
Create Date: 2026-11-17 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c4e2a91f3d'
down_revision: Union[str, Sequence[str], None] = 'e9cdd61b7f2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_llm_keys',
        sa.Column('selected_model', sa.String(length=255), nullable=True),
    )
    # Keys that relied on Groq's retired default now point at a live model.
    # (Nothing was stored before, so there is no data to rewrite.)


def downgrade() -> None:
    op.drop_column('user_llm_keys', 'selected_model')
